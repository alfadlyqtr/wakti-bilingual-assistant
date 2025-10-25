// Define Difficulty type locally
export type Difficulty = 'easy' | 'medium' | 'hard' | 'master';

export type BookMove = { san: string; weight: number };
export type BookLine = { fenPrefix: string; moves: BookMove[] };

async function loadBook(): Promise<BookLine[]> {
  try {
    const data = await import("./book.json");
    return (data.default || []) as BookLine[];
  } catch {
    return [];
  }
}

function normalizeWeights(moves: BookMove[]): BookMove[] {
  const sum = moves.reduce((a, b) => a + Math.max(0, b.weight || 0), 0) || 1;
  return moves.map(m => ({ san: m.san, weight: Math.max(0, m.weight || 0) / sum }));
}

function pickWeighted(moves: BookMove[], bias: number): BookMove | null {
  if (!moves.length) return null;
  const norm = normalizeWeights(moves);
  if (bias <= 0) return norm[0];
  const adjusted = norm.map((m, i) => ({ san: m.san, weight: m.weight * Math.pow(0.85, i * bias) }));
  const total = adjusted.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const m of adjusted) { r -= m.weight; if (r <= 0) return m; }
  return adjusted[0];
}

export async function getBookMove(fen: string, difficulty: Difficulty): Promise<string | null> {
  const book = await loadBook();
  const first = book.find(b => fen.startsWith(b.fenPrefix));
  if (!first || !first.moves?.length) return null;
  const bias = difficulty === 'easy' ? 1.5 : difficulty === 'medium' ? 0.8 : 0.2;
  const pick = pickWeighted(first.moves, bias);
  return pick ? pick.san : null;
}
