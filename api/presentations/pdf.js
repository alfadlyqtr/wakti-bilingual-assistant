module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  try {
    const apiKey = process.env.BROWSERLESS_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'BROWSERLESS_API_KEY not configured' }));
      return;
    }

    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 15 * 1024 * 1024) {
          reject(new Error('Request body too large'));
          try { req.destroy(); } catch (_) {}
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { html } = parsed || {};
    if (!html || typeof html !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing html' }));
      return;
    }

    // Use Browserless /pdf endpoint (production-sfo host, correct per v2 docs).
    // Send html + options. Viewport set to 1920x1080 so the slide renders at design size.
    // Each call returns a single-page PDF; frontend stitches them into one file.
    const endpoint = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(apiKey)}`;

    const browserlessResp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        viewport: {
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        },
        gotoOptions: {
          waitUntil: 'networkidle2',
        },
        options: {
          printBackground: true,
          width: '1920px',
          height: '1080px',
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        },
      }),
    });

    if (!browserlessResp.ok) {
      const errText = await browserlessResp.text().catch(() => '');
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Browserless PDF failed',
          status: browserlessResp.status,
          details: (errText || '').slice(0, 2000),
        })
      );
      return;
    }

    const buf = Buffer.from(await browserlessResp.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: (err && err.message) ? err.message : 'screenshot_error' }));
  }
};
