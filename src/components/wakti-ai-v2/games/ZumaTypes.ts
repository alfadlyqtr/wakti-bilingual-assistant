export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver' | 'victory';

export interface ZumaGameData {
  score: number;
  level: number;
  timestamp: number;
}

export interface Ball {
  id: string;
  x: number;
  y: number;
  color: string;
  radius: number;
  distance: number; // Distance along the path
}

export interface ShotBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface GameCallbacks {
  onScoreUpdate: (score: number) => void;
  onLevelUpdate: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onGameComplete: (finalScore: number) => void;
}

export interface GameConfig {
  ballRadius: number;
  ballSpeed: number;
  shotSpeed: number;
  colors: string[];
  pathLength: number;
  matchCount: number;
}