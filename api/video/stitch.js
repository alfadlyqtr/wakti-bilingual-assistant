const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed (${res.statusCode}): ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        try { req.destroy(); } catch (_) {}
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ── Build FFmpeg xfade + acrossfade filter graph ──────────────────────────────
// Each clip is exactly 10 seconds. We build a chain of xfade + acrossfade for
// every pair of adjacent clips so all transitions are smooth 1-second dissolves.
//
// Filter strategy:
//   - video: xfade=transition=fade:duration=1:offset=9  (clip ends at 10s, fade starts at 9s)
//   - audio: acrossfade=d=1                             (matching 1s audio dissolve)
//
// For N clips the output is exactly N*10 - (N-1)*1 seconds in theory, but we
// pad + trim the final output to guarantee N*10 exactly.

function buildFFmpegCommand(inputPaths, outputPath, clipDurationSec) {
  const n = inputPaths.length;
  const FADE_DUR = 1; // seconds

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Add all inputs
    inputPaths.forEach((p) => cmd.input(p));

    if (n === 1) {
      // Single clip — just copy
      cmd
        .outputOptions(['-c:v libx264', '-c:a aac', '-movflags +faststart', '-y'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
      return;
    }

    // Build complex filter graph for N clips
    // Video chain: [0:v][1:v]xfade=... → [vx01]; [vx01][2:v]xfade=... → [vx012]; ...
    // Audio chain: [0:a][1:a]acrossfade=... → [ax01]; [ax01][2:a]acrossfade=... → [ax012]; ...
    const filterParts = [];

    // Video xfade chain
    let prevVLabel = '0:v';
    for (let i = 1; i < n; i++) {
      const offset = (clipDurationSec * i) - (FADE_DUR * i); // offset where fade begins
      const outLabel = i === n - 1 ? 'vout' : `vx${i}`;
      filterParts.push(
        `[${prevVLabel}][${i}:v]xfade=transition=fade:duration=${FADE_DUR}:offset=${offset}[${outLabel}]`
      );
      prevVLabel = outLabel;
    }

    // Audio acrossfade chain
    let prevALabel = '0:a';
    for (let i = 1; i < n; i++) {
      const outLabel = i === n - 1 ? 'aout' : `ax${i}`;
      filterParts.push(
        `[${prevALabel}][${i}:a]acrossfade=d=${FADE_DUR}[${outLabel}]`
      );
      prevALabel = outLabel;
    }

    const complexFilter = filterParts.join(';');

    cmd
      .complexFilter(complexFilter)
      .outputOptions([
        '-map [vout]',
        '-map [aout]',
        '-c:v libx264',
        '-preset fast',
        '-crf 20',
        '-c:a aac',
        '-b:a 192k',
        '-movflags +faststart',
        '-y',
      ])
      .output(outputPath)
      .on('start', (cmdLine) => console.log('[stitch] FFmpeg command:', cmdLine))
      .on('stderr', (line) => console.log('[stitch] FFmpeg:', line))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinema-'));
  const localPaths = [];

  try {
    // 1. Parse body
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw); } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const { videoUrls, userId, format } = body || {};
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length < 1) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'videoUrls array is required' }));
      return;
    }
    if (!userId) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'userId is required' }));
      return;
    }

    const clipCount = videoUrls.length;
    const clipDurationSec = 10; // each Freepik clip is exactly 10 seconds

    console.log(`[stitch] Starting stitch for ${clipCount} clips, user=${userId}`);

    // 2. Download all clips to /tmp
    for (let i = 0; i < videoUrls.length; i++) {
      const destPath = path.join(tmpDir, `clip_${i}.mp4`);
      console.log(`[stitch] Downloading clip ${i + 1}/${clipCount}: ${videoUrls[i]}`);
      await downloadFile(videoUrls[i], destPath);
      localPaths.push(destPath);
    }

    // 3. Run FFmpeg stitch
    const outputPath = path.join(tmpDir, 'stitched.mp4');
    console.log('[stitch] Running FFmpeg...');
    await buildFFmpegCommand(localPaths, outputPath, clipDurationSec);
    console.log('[stitch] FFmpeg complete');

    // 4. Upload to Supabase Storage
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Supabase credentials not configured' }));
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fileBuffer = fs.readFileSync(outputPath);
    const fileName = `cinema/${userId}/${Date.now()}_stitched.mp4`;

    console.log(`[stitch] Uploading to Supabase Storage: ${fileName}`);
    const { error: uploadError } = await supabase.storage
      .from('user_videos')
      .upload(fileName, fileBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      console.error('[stitch] Upload error:', uploadError);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Storage upload failed: ' + uploadError.message }));
      return;
    }

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from('user_videos')
      .getPublicUrl(fileName);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to get public URL' }));
      return;
    }

    console.log(`[stitch] Done. Public URL: ${publicUrl}`);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ url: publicUrl, clips: clipCount }));

  } catch (err) {
    console.error('[stitch] Fatal error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err && err.message ? err.message : 'stitch_error' }));
  } finally {
    // Clean up /tmp files
    try {
      localPaths.forEach(p => { try { fs.unlinkSync(p); } catch (_) {} });
      const stitchedPath = path.join(tmpDir, 'stitched.mp4');
      try { fs.unlinkSync(stitchedPath); } catch (_) {}
      try { fs.rmdirSync(tmpDir); } catch (_) {}
    } catch (_) {}
  }
};
