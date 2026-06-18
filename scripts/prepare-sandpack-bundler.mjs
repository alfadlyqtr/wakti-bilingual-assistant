// Prepares a self-hosted, telemetry-free copy of the version-matched Sandpack
// bundler that ships inside @codesandbox/sandpack-client.
//
// Why: the official hosted bundler (2-19-8-sandpack.codesandbox.io) fires a
// telemetry beacon to https://col.csbops.io/data/sandpack after load. On
// networks that block csbops.io that call hangs ~21s and trips the preview
// timeout, and it cannot be disabled from the parent app. CodeSandbox ships an
// official off-switch: when window._env_.IS_ONPREM === "true" the bundler skips
// the beacon entirely. We copy the exact bundler files (guaranteed to match the
// installed client version) and inject that flag, then host it ourselves.

import {
  existsSync,
  rmSync,
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = join(
  root,
  'node_modules',
  '@codesandbox',
  'sandpack-client',
  'sandpack'
);
const dest = join(root, 'public', 'sandpack-bundler');

if (!existsSync(src)) {
  console.error('[prepare-bundler] Source not found:', src);
  console.error('[prepare-bundler] Run `npm install` first.');
  process.exit(1);
}

console.log('[prepare-bundler] Cleaning', dest);
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

console.log('[prepare-bundler] Copying version-matched bundler files...');
cpSync(src, dest, { recursive: true });

// Inject the official telemetry off-switch so the bundler never calls csbops.io.
const indexPath = join(dest, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('window._env_')) {
  html = html.replace(
    '<head>',
    '<head><script>window._env_={IS_ONPREM:"true"};</script>'
  );
  writeFileSync(indexPath, html, 'utf8');
  console.log('[prepare-bundler] Injected IS_ONPREM telemetry off-switch');
} else {
  console.log('[prepare-bundler] window._env_ already present, left as-is');
}

// The classic bundler hardcodes CodeSandbox package CDN hosts. On networks that
// reject CodeSandbox's TLS certificate (ERR_CERT_AUTHORITY_INVALID) the browser
// can't download dependencies. We rewrite those hardcoded hosts to same-origin
// proxy paths so the browser only ever talks to our own (trusted) domain, and
// the host (Vercel / local server) forwards to CodeSandbox server-side.
const CDN_BUCKET = 'https://prod-packager-packages.codesandbox.io';
const CDN_PACKAGER =
  'https://aiwi8rnkp5.execute-api.eu-west-1.amazonaws.com/prod/packages';

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

let patchedFiles = 0;
for (const file of walkFiles(dest)) {
  if (!/\.(js|mjs)$/i.test(file)) continue;
  let txt = readFileSync(file, 'utf8');
  if (txt.includes(CDN_BUCKET) || txt.includes(CDN_PACKAGER)) {
    txt = txt.split(CDN_PACKAGER).join('/_packager');
    txt = txt.split(CDN_BUCKET).join('/_bucket');
    writeFileSync(file, txt, 'utf8');
    patchedFiles += 1;
  }
}
console.log('[prepare-bundler] Rewrote CDN hosts to proxy paths in', patchedFiles, 'file(s)');

// Safe static hosting config for Vercel. The /_bucket and /_packager rewrites
// proxy package downloads to CodeSandbox server-side (browser never sees a
// CodeSandbox cert). Existing files are always served directly; only
// extensionless, non-existent paths fall back to index.html (this avoids the
// previous "service worker served as HTML" failure).
const vercelJson = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  cleanUrls: false,
  trailingSlash: false,
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
  rewrites: [
    {
      source: '/_bucket/:path*',
      destination: `${CDN_BUCKET}/:path*`,
    },
    {
      source: '/_packager/:path*',
      destination: `${CDN_PACKAGER}/:path*`,
    },
  ],
};
writeFileSync(
  join(dest, 'vercel.json'),
  JSON.stringify(vercelJson, null, 2) + '\n',
  'utf8'
);
console.log('[prepare-bundler] Wrote vercel.json');

const version = existsSync(join(dest, 'version.txt'))
  ? readFileSync(join(dest, 'version.txt'), 'utf8').trim()
  : 'unknown';
console.log('[prepare-bundler] Bundler build:', version);
console.log('[prepare-bundler] Done. Deployable folder:', dest);
