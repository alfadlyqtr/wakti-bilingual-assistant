'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// ffmpeg-static ships the correct binary for the current platform
// (Linux x64 on Vercel, win32 locally). No fluent-ffmpeg wrapper needed.
const FFMPEG_PATH = require('ffmpeg-static');

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadFile(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error(`Too many redirects: ${url}`));
      return;
    }
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = proto.get(url, (res) => {
      // Follow redirects (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        downloadFile(res.headers.location, destPath, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`Download failed (${res.statusCode}): ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', (err) => {
      file.close();
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

// ── Wakti Cinema FFmpeg engine ─────────────────────────────────────────────────
// EXCLUSIVELY for the Wakti Cinema workflow: up to 6 scenes × 10 s = 60 s.
//
// Filter strategy:
//   Video : chained xfade=transition=fade:duration=1 between every pair of clips.
//           Offset for pair i = i*10 - i*1  (clip 2→9s, clip 3→18s, …)
//   Audio : amix=inputs=N merges all N audio tracks into one balanced stream.
//   Clamp : -t <total>  hard-enforces exact duration (60 s for 6 clips).
//
// Uses child_process.spawn directly — no fluent-ffmpeg wrapper.

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log('[cinema-stitch] ffmpeg', args.join(' '));
    const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.stdout.on('data', (d) => {
      process.stdout.write(d);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Return last 2 000 chars of stderr for debugging
        reject(new Error(`FFmpeg exited ${code}:\n${stderr.slice(-2000)}`));
      }
    });
    proc.on('error', reject);
  });
}

// clipDurations: array of per-clip durations in seconds (e.g. [7, 10, 5, ...])
function buildArgs(inputPaths, outputPath, clipDurations) {
  const n = inputPaths.length;
  const FADE_DUR = 1;

  // Trim each clip to its target duration before stitching
  // so xfade offsets are based on the TRIMMED length.
  // We also add a -ss 0 trim per input using setpts+trim filter.
  const durations = clipDurations.map((d) => Math.max(1, Math.min(10, Number(d) || 10)));

  // Total output duration = sum of trimmed durations minus fade overlaps
  const TOTAL = durations.reduce((a, b) => a + b, 0) - FADE_DUR * (n - 1);

  // Build -i flags
  const inputArgs = [];
  inputPaths.forEach((p) => { inputArgs.push('-i', p); });

  if (n === 1) {
    return [
      ...inputArgs,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
      '-c:a', 'aac', '-b:a', '192k',
      '-t', String(durations[0]),
      '-movflags', '+faststart',
      '-y', outputPath,
    ];
  }

  // Complex filter graph
  const filterParts = [];

  // Trim each input to its target duration
  for (let i = 0; i < n; i++) {
    filterParts.push(`[${i}:v]trim=0:${durations[i]},setpts=PTS-STARTPTS[tv${i}]`);
    filterParts.push(`[${i}:a]atrim=0:${durations[i]},asetpts=PTS-STARTPTS[ta${i}]`);
  }

  // Video: chained xfade using trimmed streams
  let prevV = 'tv0';
  let offset = 0;
  for (let i = 1; i < n; i++) {
    offset += durations[i - 1] - FADE_DUR;
    const out = i === n - 1 ? 'vout' : `vx${i}`;
    filterParts.push(`[${prevV}][tv${i}]xfade=transition=fade:duration=${FADE_DUR}:offset=${offset}[${out}]`);
    prevV = out;
  }

  // Audio: amix all N trimmed streams
  const aIn = Array.from({ length: n }, (_, i) => `[ta${i}]`).join('');
  filterParts.push(`${aIn}amix=inputs=${n}:duration=longest:normalize=0[aout]`);

  const filter = filterParts.join(';');

  return [
    ...inputArgs,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', String(TOTAL),
    '-movflags', '+faststart',
    '-y', outputPath,
  ];
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
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
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let tmpDir = null;
  const localPaths = [];

  try {
    // 1. Parse body
    const raw = await readBody(req);
    let body;
    try { body = JSON.parse(raw); } catch (_) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { videoUrls, userId } = body || {};

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length < 1) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'videoUrls array is required' }));
      return;
    }
    if (!userId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'userId is required' }));
      return;
    }

    const clipCount = videoUrls.length;
    // Per-clip durations from frontend slider (default 10s each if not provided)
    const rawDurations = Array.isArray(body.clip_durations) ? body.clip_durations : [];
    const clipDurations = Array.from({ length: clipCount }, (_, i) =>
      Math.max(1, Math.min(10, Number(rawDurations[i]) || 10))
    );

    console.log(`[cinema-stitch] ${clipCount} clips → user=${userId} durations=${clipDurations.join(',')}`);
    console.log(`[cinema-stitch] ffmpeg binary: ${FFMPEG_PATH}`);

    // 2. Working directory in /tmp
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cinema-'));

    // 3. Download all clips
    for (let i = 0; i < clipCount; i++) {
      const dest = path.join(tmpDir, `clip_${i}.mp4`);
      console.log(`[cinema-stitch] Downloading ${i + 1}/${clipCount}: ${videoUrls[i]}`);
      await downloadFile(videoUrls[i], dest);
      localPaths.push(dest);
    }

    // 4. Run FFmpeg
    const outputPath = path.join(tmpDir, 'stitched.mp4');
    const args = buildArgs(localPaths, outputPath, clipDurations);
    await runFFmpeg(args);
    console.log('[cinema-stitch] FFmpeg complete');

    // 5. Upload to Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Supabase credentials not configured on server' }));
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const fileBuffer = fs.readFileSync(outputPath);
    const fileName = `cinema/${userId}/${Date.now()}_stitched.mp4`;

    console.log(`[cinema-stitch] Uploading: ${fileName} (${fileBuffer.length} bytes)`);

    const { error: uploadError } = await supabase.storage
      .from('user_videos')
      .upload(fileName, fileBuffer, { contentType: 'video/mp4', upsert: false });

    if (uploadError) {
      console.error('[cinema-stitch] Upload error:', uploadError);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Storage upload failed: ' + uploadError.message }));
      return;
    }

    const { data: urlData } = supabase.storage.from('user_videos').getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to get public URL after upload' }));
      return;
    }

    console.log(`[cinema-stitch] Done → ${publicUrl}`);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ url: publicUrl, clips: clipCount }));

  } catch (err) {
    console.error('[cinema-stitch] Fatal:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err && err.message ? err.message : 'stitch_error' }));
  } finally {
    // Clean up /tmp
    if (tmpDir) {
      try {
        localPaths.forEach((p) => { try { fs.unlinkSync(p); } catch (_) {} });
        try { fs.unlinkSync(path.join(tmpDir, 'stitched.mp4')); } catch (_) {}
        try { fs.rmdirSync(tmpDir); } catch (_) {}
      } catch (_) {}
    }
  }
};
