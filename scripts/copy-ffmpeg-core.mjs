import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(process.cwd());

const srcDir = path.join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const outDir = path.join(projectRoot, 'public', 'ffmpeg');

const files = [
  'ffmpeg-core.js',
  'ffmpeg-core.wasm',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileSafe(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Missing FFmpeg core file: ${from}`);
  }
  fs.copyFileSync(from, to);
}

try {
  ensureDir(outDir);

  for (const file of files) {
    const from = path.join(srcDir, file);
    const to = path.join(outDir, file);
    copyFileSafe(from, to);
  }

  console.log('[copy-ffmpeg-core] Copied FFmpeg core assets to public/ffmpeg');
} catch (err) {
  console.error('[copy-ffmpeg-core] Failed:', err);
  process.exit(1);
}
