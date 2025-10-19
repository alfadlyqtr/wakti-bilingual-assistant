// ESM Worker that computes moves using chess.js and a lightweight alpha-beta search
import { Chess } from 'chess.js';

type GoParams = { movetime?: number; depth?: number; nodes?: number; randomness?: number };

let initiated = false;
let currentFEN = 'startpos';
let lastAIMoveResultFen: string | null = null; // to avoid immediate ping-pong
const recentFens: string[] = []; // rolling history to discourage cycles
const MAX_RECENT = 12;

function evaluate(g: Chess, sideWhite: boolean): number {
  const vals: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // Terminal conditions
  if (g.isCheckmate()) {
    // Side to move is checkmated
    const sideToMoveIsWhite = g.turn() === 'w';
    const aiIsMated = sideToMoveIsWhite === sideWhite;
    return aiIsMated ? -1e9 : 1e9;
  }
  if (g.isStalemate() || g.isDraw()) {
    return 0;
  }
  let s = 0;
  for (const row of g.board()) {
    for (const pc of row) {
      if (!pc) continue;
      const sign = pc.color === 'w' ? 1 : -1;
      s += sign * (vals[pc.type] || 0);
    }
  }
  // Mobility: encourage active play
  try {
    const me = new Chess(g.fen());
    const opp = new Chess(g.fen()); opp.move(opp.moves()[0] || undefined as any); // rough change turn if possible
  } catch {}
  const cur = new Chess(g.fen());
  const turn = cur.turn();
  const myMoves = (() => { const gg = new Chess(g.fen()); if ((sideWhite? 'w':'b') !== turn) { /* flip by pseudo move */ } return gg.moves().length; })();
  const oppMoves = (() => { const gg = new Chess(g.fen()); gg.move(gg.moves()[0] || undefined as any); return gg.moves().length; })();
  s += (myMoves - oppMoves) * 0.5;
  // Being in check is bad
  if (g.inCheck()) s -= 20 * (g.turn() === (sideWhite ? 'w' : 'b') ? 1 : -1);
  return sideWhite ? s : -s;
}

function orderMoves(g: Chess, ms: any[]) {
  return ms.sort((a: any, b: any) => (b.flags?.includes('c') ? 1 : 0) - (a.flags?.includes('c') ? 1 : 0));
}

function quiescence(g: Chess, alpha: number, beta: number, sideWhite: boolean, start: number, maxTime: number): number {
  // Stand-pat evaluation
  let stand = evaluate(g, sideWhite);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  // Only captures to reduce horizon effect
  const caps = (g.moves({ verbose: true }) as any[]).filter(m => (m.flags || '').includes('c'));
  // Simple ordering: MVV/LVA approx via target piece value
  caps.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));
  for (const m of caps) {
    if ((performance.now() - start) > maxTime) break;
    const c = new Chess(g.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    const score = -quiescence(c, -beta, -alpha, sideWhite, start, maxTime);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function searchBest(gRoot: Chess, maxDepth: number, maxTime: number) {
  const start = performance.now();
  const aiWhite = gRoot.turn() === 'w';
  let best: any = null;
  let bestScore = -Infinity;

  const minimax = (g: Chess, depth: number, alpha: number, beta: number, maxing: boolean): number => {
    if (g.isGameOver() || (performance.now() - start) > maxTime) return evaluate(g, aiWhite);
    if (depth === 0) {
      return quiescence(g, alpha, beta, aiWhite, start, maxTime);
    }
    const moves = orderMoves(g, g.moves({ verbose: true }) as any);
    if (maxing) {
      let v = -Infinity;
      for (const m of moves) {
        const c = new Chess(g.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        // penalize repeats
        const f = c.fen();
        if (recentFens.includes(f)) {
          // apply soft penalty by shrinking beta window
          beta = Math.min(beta, v + 50);
        }
        const sc = minimax(c, depth - 1, alpha, beta, false);
        if (sc > v) v = sc; if (v > alpha) alpha = v; if (alpha >= beta) break;
      }
      return v;
    } else {
      let v = Infinity;
      for (const m of moves) {
        const c = new Chess(g.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        const f = c.fen();
        if (recentFens.includes(f)) {
          alpha = Math.max(alpha, v - 50);
        }
        const sc = minimax(c, depth - 1, alpha, beta, true);
        if (sc < v) v = sc; if (v < beta) beta = v; if (alpha >= beta) break;
      }
      return v;
    }
  };

  const legal = orderMoves(gRoot, gRoot.moves({ verbose: true }) as any);
  for (const m of legal) {
    if ((performance.now() - start) > maxTime) break;
    const c = new Chess(gRoot.fen()); c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
    // Anti ping-pong: avoid repeating the exact last AI resulting FEN if possible
    const candFen = c.fen();
    if (lastAIMoveResultFen && candFen === lastAIMoveResultFen && legal.length > 1) {
      continue;
    }
    const sc = minimax(c, Math.max(0, maxDepth - 1), -Infinity, Infinity, false);
    if (sc > bestScore || !best) { bestScore = sc; best = m; }
  }
  return best;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data || {};
  try {
    if (type === 'init') {
      initiated = true;
      (self as any).postMessage({ id, type: 'inited', ok: true });
      return;
    }
    if (!initiated) {
      (self as any).postMessage({ id, type: 'error', error: 'engine_not_inited' });
      return;
    }
    if (type === 'setPosition') {
      currentFEN = (payload?.fen || 'startpos').toString();
      (self as any).postMessage({ id, type: 'ok' });
      return;
    }
    if (type === 'go') {
      const p: GoParams = payload || {};
      const start = performance.now();
      const fen = currentFEN === 'startpos' ? new Chess().fen() : currentFEN;
      const g = new Chess(fen);
      const depth = Math.max(1, Math.min(8, Number(p.depth ?? 3)));
      const timeMs = Math.max(100, Math.min(5000, Number(p.movetime ?? 800)));
      const best = searchBest(g, depth, timeMs) || (g.moves({ verbose: true }) as any)[0] || null;
      const bm = best ? `${best.from}${best.to}${best.promotion || ''}` : null;
      if (bm) {
        const after = new Chess(fen);
        const from = bm.slice(0,2) as any; const to = bm.slice(2,4) as any; const promo = (bm.length>4? bm.slice(4,5): undefined) as any;
        try {
          after.move({ from, to, promotion: promo||'q' });
          lastAIMoveResultFen = after.fen();
          // update recent history
          recentFens.push(lastAIMoveResultFen);
          while (recentFens.length > MAX_RECENT) recentFens.shift();
        } catch {}
      }
      (self as any).postMessage({ id, type: 'bestmove', bestmove: bm, depth, timeMs: performance.now() - start });
      return;
    }
    if (type === 'stop') {
      (self as any).postMessage({ id, type: 'stopped' });
      return;
    }
    if (type === 'setOption') {
      (self as any).postMessage({ id, type: 'ok' });
      return;
    }
    (self as any).postMessage({ id, type: 'error', error: 'unknown_command' });
  } catch (err: any) {
    (self as any).postMessage({ id, type: 'error', error: String(err?.message || err) });
  }
};
