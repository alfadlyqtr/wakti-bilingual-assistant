import { DIFFICULTY, Difficulty } from './difficulty';
import { getBookMove } from '../book';

// We rely on chess.js already present in the app
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Chess } from 'chess.js';

let worker: Worker | null = null;
let seq = 0;
let pending = new Map<number, (value: any) => void>();
let currentFen: string = 'startpos';

function ensureWorker(): Worker {
  if (worker) return worker;
  // Create module worker for bundlers like Vite
  worker = new Worker(new URL('./garbochessWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const { id } = e.data || {};
    if (id && pending.has(id)) {
      const resolve = pending.get(id)!;
      pending.delete(id);
      resolve(e.data);
    }
  };
  return worker;
}

async function call(type: string, payload?: any): Promise<any> {
  const w = ensureWorker();
  const id = ++seq;
  const msg = { id, type, payload };
  const p = new Promise<any>((resolve) => pending.set(id, resolve));
  w.postMessage(msg);
  return p;
}

export async function initEngine(): Promise<void> {
  await call('init');
}

export async function setPosition(fen: string): Promise<void> {
  currentFen = fen;
  await call('setPosition', { fen });
}

function sanToUci(fen: string, san: string): string | null {
  try {
    const g = new Chess(fen);
    const move = g.move(san, { sloppy: true } as any);
    if (!move) return null;
    return `${move.from}${move.to}${move.promotion ? move.promotion : ''}`;
  } catch {
    return null;
  }
}

function randomLegalUci(fen: string): string | null {
  const g = new Chess(fen);
  const moves = g.moves({ verbose: true } as any);
  if (!moves.length) return null;
  const m = moves[Math.floor(Math.random() * moves.length)];
  return `${m.from}${m.to}${m.promotion || ''}`;
}

function shallowBestUci(fen: string, maxDepth = 2, maxTimeMs = 400): string | null {
  const start = performance.now();
  const root = new Chess(fen);
  const aiIsWhite = root.turn() === 'w';
  let best: any = null;
  let bestScore = -Infinity;

  const value = (g: any): number => {
    // material only quick eval
    const vals: any = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
    let s = 0;
    for (const row of g.board()) {
      for (const pc of row) {
        if (!pc) continue;
        const sign = pc.color === 'w' ? 1 : -1;
        s += sign * vals[pc.type];
      }
    }
    return aiIsWhite ? s : -s;
  };

  const order = (g: any, ms: any[]) => ms.sort((a: any, b: any) => (b.flags?.includes('c')?1:0) - (a.flags?.includes('c')?1:0));

  const minimax = (g: any, depth: number, alpha: number, beta: number, maxing: boolean): number => {
    if (depth === 0 || g.isGameOver() || (performance.now() - start) > maxTimeMs) return value(g);
    const moves = order(g, g.moves({ verbose: true } as any));
    if (maxing) {
      let v = -Infinity;
      for (const m of moves) {
        const c = new Chess(g.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion||'q' });
        const sc = minimax(c, depth - 1, alpha, beta, false);
        if (sc > v) v = sc; if (v > alpha) alpha = v; if (alpha >= beta) break;
      }
      return v;
    } else {
      let v = Infinity;
      for (const m of moves) {
        const c = new Chess(g.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion||'q' });
        const sc = minimax(c, depth - 1, alpha, beta, true);
        if (sc < v) v = sc; if (v < beta) beta = v; if (alpha >= beta) break;
      }
      return v;
    }
  };

  const legal = order(root, root.moves({ verbose: true } as any));
  for (const m of legal) {
    if ((performance.now() - start) > maxTimeMs) break;
    const c = new Chess(root.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion||'q' });
    const sc = minimax(c, Math.max(0, maxDepth - 1), -Infinity, Infinity, false);
    if (sc > bestScore || !best) { bestScore = sc; best = m; }
  }
  return best ? `${best.from}${best.to}${best.promotion||''}` : null;
}

export async function bestMove(fen: string, difficulty: Difficulty): Promise<{ bestmove: string } | null> {
  // 1) Opening book
  try {
    const san = await getBookMove(fen, difficulty);
    if (san) {
      const uci = sanToUci(fen, san);
      if (uci) return { bestmove: uci };
    }
  } catch {}

  // 2) Engine worker
  try {
    const d = DIFFICULTY[difficulty];
    const res = await call('go', { movetime: d.maxTimeMs, depth: d.maxDepth, nodes: d.maxNodes, randomness: d.temperature });
    if (res?.bestmove) return { bestmove: res.bestmove };
  } catch {}

  // 3) Fallback shallow search so testing works even with placeholder engine
  const fallback = shallowBestUci(fen, difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1, DIFFICULTY[difficulty].maxTimeMs);
  if (fallback) return { bestmove: fallback };
  // 4) Random legal as last resort
  const rnd = randomLegalUci(fen);
  return rnd ? { bestmove: rnd } : null;
}
