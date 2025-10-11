/*
  Stockfish Web Worker bridge
  - Loads Stockfish WASM via CDN
  - Accepts messages: { type: 'go', fen: string, difficulty: 'easy'|'medium'|'hard' }
  - Replies with: { type: 'bestmove', bestmove: string } or { type: 'error', error: string }
*/

// Worker typing helpers for TS (avoid ts lib.dom worker dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = self as any;

// Try to load Stockfish from local paths first, then CDNs
function tryLoadStockfish(): Promise<void> {
  const urls = [
    // Prefer locally vendored files
    '/stockfish.js',
    'stockfish.js',
    './stockfish.js',
    '/stockfish/stockfish.js',
    `${(self as any).location?.origin || ''}/stockfish.js`,
    'https://cdn.jsdelivr.net/npm/stockfish/stockfish.wasm.js',
    'https://unpkg.com/stockfish/stockfish.wasm.js',
    // version-pinned fallbacks
    'https://cdn.jsdelivr.net/npm/stockfish@16.1.0/stockfish.wasm.js',
    'https://unpkg.com/stockfish@16.1.0/stockfish.wasm.js',
    // asm.js (no COI required) fallbacks
    'https://cdn.jsdelivr.net/npm/stockfish/stockfish.js',
    'https://unpkg.com/stockfish/stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish@16.1.0/stockfish.js',
    'https://unpkg.com/stockfish@16.1.0/stockfish.js'
  ];

  return new Promise((resolve, reject) => {
    let idx = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).__sf_loaded_from = undefined;
    const next = () => {
      if (idx >= urls.length) return reject(new Error('Failed to load Stockfish from all CDNs'));
      const url = urls[idx++];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (self as any).importScripts(url);
        // Give the global factory a brief moment to attach
        const t = setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((self as any).Stockfish) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (self as any).__sf_loaded_from = url;
            resolve();
          }
          else next();
        }, 20);
        // no-op; t kept local
      } catch {
        next();
      }
    };
    next();
  });
}

// stockfish factory is globally exposed by the script above
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engine: any | null = null;
let ready = false;

async function ensureEngine() {
  if (engine) return;
  try {
    await tryLoadStockfish();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    engine = (self as any).Stockfish();
    engine.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line.includes('readyok')) ready = true;
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const bestmove = parts[1] || '';
        ctx.postMessage({ type: 'bestmove', bestmove });
      }
    };
    engine.postMessage('uci');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = (self as any).__sf_loaded_from || 'unknown';
      ctx.postMessage({ type: 'engine_loaded', source: src });
    } catch {}
  } catch (e: any) {
    ctx.postMessage({ type: 'error', error: e?.message || 'Engine load failed' });
  }
}

// Map difficulty to engine options
function difficultyToUci(difficulty: 'easy'|'medium'|'hard') {
  switch (difficulty) {
    case 'easy':
      return { skill: 2, movetime: 500, contempt: 0, multipv: 1 }; // light and a bit blundery
    case 'medium':
      return { skill: 8, movetime: 1000, contempt: 10, multipv: 1 };
    case 'hard':
    default:
      return { skill: 14, movetime: 2000, contempt: 0, multipv: 1 };
  }
}

async function go(fen: string, difficulty: 'easy'|'medium'|'hard') {
  await ensureEngine();
  if (!engine) {
    ctx.postMessage({ type: 'error', error: 'Engine not available' });
    return;
  }
  const { skill, movetime, contempt, multipv } = difficultyToUci(difficulty);
  if (!ready) engine.postMessage('isready');
  engine.postMessage('ucinewgame');
  engine.postMessage(`setoption name Skill Level value ${skill}`);
  engine.postMessage(`setoption name Contempt value ${contempt}`);
  engine.postMessage(`setoption name MultiPV value ${multipv}`);
  engine.postMessage(`position fen ${fen}`);
  engine.postMessage(`go movetime ${movetime}`);
}

ctx.addEventListener('message', (evt: MessageEvent) => {
  const data = evt.data as { type: string; fen?: string; difficulty?: 'easy'|'medium'|'hard' };
  try {
    if (data.type === 'go' && data.fen && data.difficulty) {
      go(data.fen, data.difficulty);
      return;
    }
    if (data.type === 'terminate') {
      if (engine) {
        try { engine.postMessage('quit'); } catch {}
      }
      // Terminate worker from within
      self.close();
      return;
    }
  } catch (e: any) {
    ctx.postMessage({ type: 'error', error: e?.message || String(e) });
  }
});
