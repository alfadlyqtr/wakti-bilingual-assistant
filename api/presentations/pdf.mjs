export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const apiKey = process.env.BROWSERLESS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'BROWSERLESS_API_KEY not configured' });
      return;
    }

    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        // Guardrail: Vercel functions have body limits; fail early if extremely large
        if (data.length > 15 * 1024 * 1024) {
          reject(new Error('Request body too large'));
          req.destroy();
        }
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const { html, pdfOptions } = parsed || {};
    if (!html || typeof html !== 'string') {
      res.status(400).json({ error: 'Missing html' });
      return;
    }

    const endpoint = `https://chrome.browserless.io/pdf?token=${encodeURIComponent(apiKey)}`;

    const browserlessResp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        options: {
          printBackground: true,
          preferCSSPageSize: true,
          ...pdfOptions,
        },
      }),
    });

    if (!browserlessResp.ok) {
      const errText = await browserlessResp.text().catch(() => '');
      res.status(502).json({ error: 'Browserless PDF failed', status: browserlessResp.status, details: errText.slice(0, 2000) });
      return;
    }

    const buf = Buffer.from(await browserlessResp.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'pdf_error' });
  }
}
