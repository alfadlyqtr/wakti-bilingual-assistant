const https = require('https');

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const reqHttp = https.request(options, (resp) => {
      const chunks = [];
      resp.on('data', (chunk) => chunks.push(chunk));
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: Buffer.concat(chunks) }));
    });
    reqHttp.on('error', reject);
    reqHttp.write(data);
    reqHttp.end();
  });
}

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

    const endpoint = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(apiKey)}`;

    const payload = JSON.stringify({
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

    const browserlessResp = await httpsPost(endpoint, payload);

    if (browserlessResp.status !== 200) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Browserless PDF failed',
          status: browserlessResp.status,
          details: browserlessResp.body.toString('utf8').slice(0, 2000),
        })
      );
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(browserlessResp.body);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: (err && err.message) ? err.message : 'screenshot_error' }));
  }
};
