export type Difficulty = 'easy' | 'medium' | 'hard' | 'master';

export const DIFFICULTY: Record<Difficulty, {
  maxDepth: number;
  maxTimeMs: number;
  maxNodes?: number;
  topN: number;
  temperature: number;
  blunderRate: number;
}> = {
  easy:   { maxDepth: 2, maxTimeMs: 450,  maxNodes: 5e4,  topN: 3, temperature: 0.6,  blunderRate: 0.015 },
  medium: { maxDepth: 4, maxTimeMs: 1200, maxNodes: 2e5,  topN: 2, temperature: 0.25, blunderRate: 0.004 },
  hard:   { maxDepth: 6, maxTimeMs: 2500, maxNodes: 8e5,  topN: 1, temperature: 0.0,  blunderRate: 0.0   },
  master: { maxDepth: 8, maxTimeMs: 4000, maxNodes: 12e5, topN: 1, temperature: 0.0,  blunderRate: 0.0   },
};

export function pickWithTemperature<T>(items: T[], temperature: number): T {
  if (items.length === 0) throw new Error('empty');
  if (items.length === 1 || temperature <= 0) return items[0];
  const weights = items.map((_, i) => Math.exp(-(i) / Math.max(0.001, temperature)));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[0];
}
