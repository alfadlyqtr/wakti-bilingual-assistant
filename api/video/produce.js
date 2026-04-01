'use strict';

// ── Wakti Cinema Producer — Shotstack API ─────────────────────────────────────
// Accepts: imageUrls[], scripts[], logoUrl?, contactInfo?, format, sceneCount
// Builds a Shotstack timeline: each image animated 10s, fade transitions,
// captions burned per scene, contact overlay on final scene.
// Returns: { renderId } immediately. Frontend polls /api/video/produce?renderId=xxx

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY;
const SHOTSTACK_BASE = 'https://api.shotstack.io/v1';

// ── CORS preflight ────────────────────────────────────────────────────────────
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
}

// ── Shotstack HTTP helper ─────────────────────────────────────────────────────
async function shotstackRequest(method, path, body) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.shotstack.io',
      path: `/v1${path}`,
      method,
      headers: {
        'x-api-key': SHOTSTACK_API_KEY,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(`Shotstack ${res.statusCode}: ${JSON.stringify(parsed)}`));
          else resolve(parsed);
        } catch (e) {
          reject(new Error(`Shotstack parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Build Shotstack timeline ──────────────────────────────────────────────────
function buildTimeline({ imageUrls, scripts, logoUrl, contactInfo, format, clipDuration }) {
  const duration = clipDuration || 10; // seconds per scene
  const transitionDuration = 1;        // 1s fade overlap

  // Each clip starts at: idx * (duration - transitionDuration)
  // so clips overlap by 1s for smooth fade
  const tracks = [];

  // ── Track 0: Image clips (I2V animated via Shotstack ImageToVideoAsset) ──
  const imageClips = imageUrls.map((url, idx) => {
    const start = idx * (duration - transitionDuration);
    return {
      asset: {
        type: 'image',
        src: url,
      },
      start,
      length: duration,
      effect: 'zoomIn',          // Shotstack built-in Ken Burns / zoom effect
      transition: {
        in: idx === 0 ? 'fade' : 'fade',
        out: 'fade',
      },
    };
  });
  tracks.push({ clips: imageClips });

  // ── Track 1: Caption clips — scene script text per clip ──
  const captionClips = scripts.map((script, idx) => {
    if (!script) return null;
    const start = idx * (duration - transitionDuration) + 1; // 1s delay after clip starts
    const textLength = Math.max(2, duration - 2);
    return {
      asset: {
        type: 'text',
        text: script,
        width: 900,
        height: 200,
        background: 'rgba(0,0,0,0)',
        color: '#FFFFFF',
        size: 30,
        style: 'future',
        position: 'bottom',
        offset: { y: -0.08 },
      },
      start,
      length: textLength,
      transition: { in: 'fade', out: 'fade' },
    };
  }).filter(Boolean);
  if (captionClips.length > 0) tracks.push({ clips: captionClips });

  // ── Track 2: Final scene overlay — contactInfo + slogan ──
  if (contactInfo) {
    const lastIdx = imageUrls.length - 1;
    const overlayStart = lastIdx * (duration - transitionDuration) + 2;
    const overlayText = `Heritage in Motion\n${contactInfo}`;
    tracks.push({
      clips: [{
        asset: {
          type: 'text',
          text: overlayText,
          width: 800,
          height: 300,
          background: 'rgba(0,0,0,0)',
          color: '#E2C7A8',
          size: 36,
          style: 'future',
          position: 'center',
          offset: { y: 0.15 },
        },
        start: overlayStart,
        length: duration - 3,
        transition: { in: 'fade', out: 'fade' },
      }],
    });
  }

  // ── Track 3: Logo overlay on final scene ──
  if (logoUrl) {
    const lastIdx = imageUrls.length - 1;
    const logoStart = lastIdx * (duration - transitionDuration);
    tracks.push({
      clips: [{
        asset: {
          type: 'image',
          src: logoUrl,
          volume: 0,
        },
        start: logoStart,
        length: duration,
        scale: 0.25,
        position: 'topLeft',
        offset: { x: 0.02, y: -0.02 },
        transition: { in: 'fade', out: 'fade' },
      }],
    });
  }

  return {
    soundtrack: null,
    background: '#000000',
    tracks,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (!SHOTSTACK_API_KEY) {
    return res.status(500).json({ error: 'SHOTSTACK_API_KEY not configured' });
  }

  // ── GET: Poll render status ──
  if (req.method === 'GET') {
    const { renderId } = req.query;
    if (!renderId) return res.status(400).json({ error: 'renderId required' });
    try {
      const data = await shotstackRequest('GET', `/render/${renderId}`);
      const r = data.response;
      return res.json({
        status: r.status,           // queued | fetching | rendering | saving | done | failed
        url: r.url || null,         // final MP4 URL when done
        progress: r.progress || 0,
        error: r.error || null,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Submit render ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const {
    imageUrls,
    scripts,
    logoUrl,
    contactInfo,
    format = '9:16',
    clipDuration = 10,
  } = body;

  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length < 1) {
    return res.status(400).json({ error: 'imageUrls[] required' });
  }
  if (!scripts || !Array.isArray(scripts)) {
    return res.status(400).json({ error: 'scripts[] required' });
  }

  // Pad scripts to match imageUrls length
  const paddedScripts = imageUrls.map((_, i) => scripts[i] || '');

  // Shotstack output dimensions
  const isPortrait = format === '9:16';
  const outputWidth = isPortrait ? 720 : 1280;
  const outputHeight = isPortrait ? 1280 : 720;

  const timeline = buildTimeline({
    imageUrls,
    scripts: paddedScripts,
    logoUrl: logoUrl || null,
    contactInfo: contactInfo || null,
    format,
    clipDuration,
  });

  const renderPayload = {
    timeline,
    output: {
      format: 'mp4',
      resolution: 'hd',
      aspectRatio: isPortrait ? '9:16' : '16:9',
      size: { width: outputWidth, height: outputHeight },
      fps: 25,
      quality: 'high',
    },
  };

  try {
    const data = await shotstackRequest('POST', '/render', renderPayload);
    const renderId = data.response?.id;
    if (!renderId) throw new Error('No renderId returned from Shotstack');
    return res.json({ ok: true, renderId });
  } catch (err) {
    console.error('[produce] Shotstack render error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
