import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(process.cwd());

const srcDir = path.join(projectRoot, 'node_modules', '@cesdk', 'engine', 'assets');
const outDir = path.join(projectRoot, 'public', 'cesdk-assets');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-cesdk-assets] Source not found: ${src}`);
    return;
  }

  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  
  copyRecursive(srcDir, outDir);
  console.log('[copy-cesdk-assets] Copied CE.SDK assets to public/cesdk-assets');
} catch (err) {
  console.error('[copy-cesdk-assets] Failed:', err);
  process.exit(1);
}
