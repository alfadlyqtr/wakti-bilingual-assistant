import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createWriteStream, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Anthropic from '@anthropic-ai/sdk';

const execFileAsync = promisify(execFile);

const app = express();
app.set('trust proxy', 1);
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Allow any localhost / 127.0.0.1 port (dev servers on any port)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow any HTTPS origin (Netlify, custom domains like wakti.qa)
    if (origin.startsWith('https://')) return callback(null, true);
    // Allow explicitly listed origins
    const ok = allowed.some(a => origin.startsWith(a));
    return callback(null, ok);
  },
  credentials: false,
  methods: ['POST','OPTIONS','GET'],
  allowedHeaders: ['content-type','authorization','cache-control','accept']
}));
app.use(express.json({ limit: '20mb' }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(language, personalTouch) {
  const pt = personalTouch || {};
  const nick = (pt.nickname || '').trim();
  const tone = (pt.tone || '').trim();
  const style = (pt.style || '').trim();
  const langRule = language === 'ar' ? 'CRITICAL: Respond ONLY in Arabic.' : 'CRITICAL: Respond ONLY in English.';
  return `${langRule}\n${nick ? `Nickname:${nick}` : ''}\n${tone ? `Tone:${tone}` : ''}\n${style ? `Style:${style}` : ''}`;
}

app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

function browserlessPdf(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'production-sfo.browserless.io',
      path: `/pdf?token=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (resp) => {
      const chunks = [];
      resp.on('data', (chunk) => chunks.push(chunk));
      resp.on('end', () => resolve({ status: resp.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

app.post('/api/presentations/pdf', async (req, res) => {
  try {
    const apiKey = process.env.BROWSERLESS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'BROWSERLESS_API_KEY not configured' });
    }
    const { html } = req.body || {};
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'Missing html' });
    }
    const result = await browserlessPdf(apiKey, {
      html,
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      gotoOptions: { waitUntil: 'networkidle2' },
      options: {
        printBackground: true,
        width: '1920px',
        height: '1080px',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      },
    });
    if (result.status !== 200) {
      return res.status(502).json({
        error: 'Browserless PDF failed',
        status: result.status,
        details: result.body.toString('utf8').slice(0, 2000),
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(result.body);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'pdf_error' });
  }
});

app.post('/api/vision-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') try { res.flushHeaders(); } catch {}

  try {
    const { images, prompt, language, personalTouch } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'No images' })}\n\n`);
      return res.end();
    }

    const system = buildSystemPrompt(language || 'en', personalTouch);
    const content = [{ type: 'text', text: prompt || 'Analyze this image' }];
    for (const img of images) {
      if (!img?.base64 || !img?.mimeType) continue;
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType.replace('image/jpg', 'image/jpeg'), data: img.base64 }
      });
    }

    const stream = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content }],
      stream: true
    });

    let jsonEmitted = false;
    let buf = '';
    let depth = 0;
    let inStr = false;
    let esc = false;

    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta?.text) {
        const token = ev.delta.text;
        if (!jsonEmitted) {
          for (const ch of token) {
            if (ch === '{' && depth === 0) { depth = 1; buf = '{'; continue; }
            if (depth > 0) {
              buf += ch;
              if (inStr) {
                if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
              } else {
                if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) {
                  try { const obj = JSON.parse(buf); res.write(`data: ${JSON.stringify({ json: obj })}\n\n`); jsonEmitted = true; } catch {}
                } }
              }
            }
          }
        }
        if (jsonEmitted) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
      if (ev.type === 'message_stop') {
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err?.message || 'vision_error' })}\n\n`);
    res.end();
  }
});

// ── Cinema Stitch: download 6 clips, FFmpeg xfade concat, return video URL ──
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = createWriteStream(destPath);
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        file.close();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

app.post('/api/cinema/stitch', async (req, res) => {
  const workDir = join(tmpdir(), `cinema_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const filesToCleanup = [];

  try {
    const { clip_urls } = req.body || {};
    if (!Array.isArray(clip_urls) || clip_urls.length < 2) {
      return res.status(400).json({ error: 'clip_urls must be an array of at least 2 URLs' });
    }
    if (clip_urls.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 clips supported' });
    }

    mkdirSync(workDir, { recursive: true });

    // Download all clips
    const clipPaths = [];
    for (let i = 0; i < clip_urls.length; i++) {
      const clipPath = join(workDir, `clip${i}.mp4`);
      console.log(`[cinema-stitch] Downloading clip ${i + 1}/${clip_urls.length}: ${clip_urls[i].slice(0, 80)}`);
      await downloadFile(clip_urls[i], clipPath);
      clipPaths.push(clipPath);
      filesToCleanup.push(clipPath);
    }

    // Build FFmpeg xfade filter for prism-glass blur transition (0.5s each)
    // We use the "fade" xfade transition as a cinematic blend between clips
    const transitionDuration = 0.5;
    const clipDuration = 10; // each clip is 10s

    const inputs = clipPaths.flatMap(p => ['-i', p]);

    // Build xfade filter chain
    // Clips: [0][1][2][3][4][5]
    // Apply xfade between each pair with offset = (clipDuration - transitionDuration) * pairIndex
    let filterComplex = '';
    let currentLabel = '[0:v]';
    for (let i = 1; i < clipPaths.length; i++) {
      const offset = (clipDuration - transitionDuration) * i;
      const nextLabel = i < clipPaths.length - 1 ? `[v${i}]` : '[vout]';
      filterComplex += `${currentLabel}[${i}:v]xfade=transition=fadeblack:duration=${transitionDuration}:offset=${offset}${nextLabel};`;
      currentLabel = nextLabel;
    }
    // Remove trailing semicolon
    filterComplex = filterComplex.replace(/;$/, '');

    const outputPath = join(workDir, 'premiere.mp4');
    filesToCleanup.push(outputPath);

    const ffmpegArgs = [
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    console.log(`[cinema-stitch] Running FFmpeg for ${clipPaths.length} clips`);
    await execFileAsync('ffmpeg', ffmpegArgs, { maxBuffer: 100 * 1024 * 1024 });
    console.log('[cinema-stitch] FFmpeg complete, reading output');

    // Stream the file back directly
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');

    const { createReadStream } = await import('fs');
    const stream = createReadStream(outputPath);
    stream.pipe(res);
    stream.on('end', () => {
      // Cleanup temp files after sending
      for (const f of filesToCleanup) {
        try { if (existsSync(f)) unlinkSync(f); } catch {}
      }
      try { mkdirSync(workDir); unlinkSync(workDir); } catch {}
    });
    stream.on('error', (err) => {
      console.error('[cinema-stitch] Stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to stream output' });
    });

  } catch (err) {
    console.error('[cinema-stitch] Error:', err);
    // Cleanup on error
    for (const f of filesToCleanup) {
      try { if (existsSync(f)) unlinkSync(f); } catch {}
    }
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'stitch_error' });
    }
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => { console.log(`Vision proxy listening on http://localhost:${PORT}`); });
// Allow long-running requests (cinema stitch can take several minutes)
server.setTimeout(10 * 60 * 1000);
