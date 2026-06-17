// Tiny dependency-free static server for local testing of the self-hosted
// Sandpack bundler. Serves ./wakti-sandpack-bundler at http://localhost:5174
// so we can prove the telemetry-free bundler works before deploying it.

import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
  existsSync,
  statSync,
  createReadStream,
} from 'node:fs';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', 'wakti-sandpack-bundler');
const PORT = process.env.BUNDLER_PORT ? Number(process.env.BUNDLER_PORT) : 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

if (!existsSync(root)) {
  console.error('[serve-bundler] Folder not found:', root);
  console.error('[serve-bundler] Run `npm run bundler:prepare` first.');
  process.exit(1);
}

// Same-origin proxy paths the bundler now uses for package downloads, forwarded
// to CodeSandbox server-side so the browser never sees a CodeSandbox cert.
const PROXY_TARGETS = [
  {
    prefix: '/_bucket/',
    target: 'https://prod-packager-packages.codesandbox.io/',
  },
  {
    prefix: '/_packager/',
    target: 'https://aiwi8rnkp5.execute-api.eu-west-1.amazonaws.com/prod/packages/',
  },
];

function proxyRequest(targetUrl, req, res) {
  const upstream = httpsRequest(
    targetUrl,
    {
      method: req.method || 'GET',
      headers: { 'user-agent': 'wakti-bundler-proxy', accept: '*/*' },
      // LOCAL DEV ONLY: ignore TLS verification so a local AV/proxy MITM cannot
      // block package downloads while we test. Production uses Vercel's secure
      // server-side proxy (vercel.json rewrites), which verifies certificates.
      rejectUnauthorized: false,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, {
        ...upRes.headers,
        'access-control-allow-origin': '*',
      });
      upRes.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    console.error('[serve-bundler] proxy error', targetUrl.href, err.message);
    res.writeHead(502, {
      'content-type': 'text/plain',
      'access-control-allow-origin': '*',
    });
    res.end('Proxy error: ' + err.message);
  });
  upstream.end();
}

function resolvePath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const full = normalize(join(root, p));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = createServer((req, res) => {
  const reqUrl = req.url || '/';

  const proxy = PROXY_TARGETS.find((p) => reqUrl.startsWith(p.prefix));
  if (proxy) {
    const targetUrl = new URL(reqUrl.slice(proxy.prefix.length), proxy.target);
    proxyRequest(targetUrl, req, res);
    return;
  }

  let full = resolvePath(reqUrl);
  if (!full) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!existsSync(full) || statSync(full).isDirectory()) {
    if (!extname(full)) {
      full = join(root, 'index.html');
    }
  }

  if (!existsSync(full)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const type = MIME[extname(full).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Service-Worker-Allowed': '/',
    'Cache-Control': 'no-cache',
  });
  createReadStream(full).pipe(res);
});

server.listen(PORT, () => {
  console.log(`[serve-bundler] Serving ${root}`);
  console.log(`[serve-bundler] http://localhost:${PORT}`);
});
