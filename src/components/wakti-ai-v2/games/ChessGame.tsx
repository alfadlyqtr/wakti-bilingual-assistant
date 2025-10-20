import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { t } from '@/utils/translations';
import { TranslationKey } from '@/utils/translationTypes';

interface ChessGameProps {
  onBack: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'master';
type PlayerColor = 'white' | 'black';

const getAIRemarks = (difficulty: Difficulty, language: string) => {
  const remarkKeys: Record<Difficulty, TranslationKey[]> = {
    easy: ['chess_easy_nice_move', 'chess_easy_didnt_see', 'chess_easy_oops', 'chess_easy_learning', 'chess_easy_mistake'],
    medium: ['chess_medium_sure', 'chess_medium_interesting', 'chess_medium_solid', 'chess_medium_thinking', 'chess_medium_challenge'],
    hard: ['chess_hard_wont_survive', 'chess_hard_simulation', 'chess_hard_try_again', 'chess_hard_calculated', 'chess_hard_inevitable'],
    master: ['chess_hard_wont_survive', 'chess_hard_simulation', 'chess_hard_try_again', 'chess_hard_calculated', 'chess_hard_inevitable']
  };
  return remarkKeys[difficulty].map(key => t(key, language));
};

const getVictoryRemarks = (isPlayerWin: boolean, isDraw: boolean, language: string) => {
  if (isDraw) return [
    language === 'ar' ? 'تعادل! مباراة متوازنة 👏' : 'Draw! Well balanced game 👏'
  ];
  if (isPlayerWin) return [
    language === 'ar' ? 'كش مات! انتصار جميل 👑✨' : 'Checkmate! Beautiful finish 👑✨',
    language === 'ar' ? 'شيء أسطوري! مات الملك 👑🔥' : 'Legendary! The king has fallen 👑🔥'
  ];
  return [
    language === 'ar' ? 'كش مات... سأعود أقوى 😤' : 'Checkmate... I will return stronger 😤',
    language === 'ar' ? 'انتهت! مات ملكي 😵‍💫' : 'It is over! My king is down 😵‍💫'
  ];
};

// Piece values for evaluation
const PIECE_VALUES = {
  'p': 100, 'n': 300, 'b': 300, 'r': 500, 'q': 900, 'k': 10000
};

export function ChessGame({ onBack }: ChessGameProps) {
  const { language } = useTheme();
  const { showSuccess, showInfo, showError } = useToastHelper();
  
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState<PlayerColor>('white');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [currentAIRemark, setCurrentAIRemark] = useState<string>('');
  const [isAIThinking, setIsAIThinking] = useState(false);
  // Internal AI helpers
  const repetitionRef = useRef<Record<string, number>>({});
  const lastPlayerFenRef = useRef<string | null>(null);
  const lastRemarkRef = useRef<string>('');
  const [checkBanner, setCheckBanner] = useState<string>('');
  const [checkedSquare, setCheckedSquare] = useState<string | null>(null);
  const [mateBanner, setMateBanner] = useState<string>('');
  
  // New states for tap-to-move system
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  // Option A: Recent FEN buffer to avoid repetition cycles
  const recentFensRef = useRef<string[]>([]);
  // Phase 2: Threefold repetition detection (position count map)
  const fenCountsRef = useRef<Map<string, number>>(new Map());

  // Phase 1: Centralized engine profiles (behavioral per difficulty)
  const ENGINE_PROFILES = {
    easy:   { movetime: 120,  maxDepth: 2, variety: 0.6, allowBlunder: 0.30 },
    medium: { movetime: 350,  maxDepth: 3, variety: 0.20, allowBlunder: 0.00 },
    hard:   { movetime: 800,  maxDepth: 5, variety: 0.05, allowBlunder: 0.00 },
    master: { movetime: 1400, maxDepth: 7, variety: 0.00, allowBlunder: 0.00 }
  } as const;

  // Track repetitions for anti-repeat behavior
  useEffect(() => {
    const fen = game.fen();
    repetitionRef.current[fen] = (repetitionRef.current[fen] || 0) + 1;
  }, [game]);

  // Evaluation helpers
  const pieceSquareTables: Record<string, number[][]> = {
    p: [
      [0,0,0,0,0,0,0,0],
      [5,5,5,5,5,5,5,5],
      [1,1,2,3,3,2,1,1],
      [0,0,0,2,2,0,0,0],
      [0,0,0,-2,-2,0,0,0],
      [1,-1,-2,0,0,-2,-1,1],
      [1,2,2,-3,-3,2,2,1],
      [0,0,0,0,0,0,0,0]
    ],
    n: [
      [-5,-4,-3,-3,-3,-3,-4,-5],
      [-4,-2,0,0,0,0,-2,-4],
      [-3,0,1,1.5,1.5,1,0,-3],
      [-3,0.5,1.5,2,2,1.5,0.5,-3],
      [-3,0,1.5,2,2,1.5,0,-3],
      [-3,0.5,1,1.5,1.5,1,0.5,-3],
      [-4,-2,0,0.5,0.5,0,-2,-4],
      [-5,-4,-3,-3,-3,-3,-4,-5]
    ],
    b: [
      [-2,-1,-1,-1,-1,-1,-1,-2],
      [-1,0,0,0,0,0,0,-1],
      [-1,0,0.5,1,1,0.5,0,-1],
      [-1,0.5,0.5,1,1,0.5,0.5,-1],
      [-1,0,1,1,1,1,0,-1],
      [-1,1,1,1,1,1,1,-1],
      [-1,0.5,0,0,0,0,0.5,-1],
      [-2,-1,-1,-1,-1,-1,-1,-2]
    ],
    r: [
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [2,2,2,2,2,2,2,2],
      [2,2,2,2,2,2,2,2]
    ],
    q: [
      [0,0,0.5,1,1,0.5,0,0],
      [0,0.5,0.5,0.5,0.5,0.5,0.5,0],
      [0,0.5,0.5,0.5,0.5,0.5,0.5,0],
      [0,0.5,0.5,0.5,0.5,0.5,0.5,0],
      [0,0.5,0.5,0.5,0.5,0.5,0.5,0],
      [0,0.5,0.5,0.5,0.5,0.5,0.5,0],
      [0,0.5,0.5,0.5,0.5,0.5,0.5,0],
      [0,0,0.5,1,1,0.5,0,0]
    ],
    k: [
      [-3,-4,-4,-5,-5,-4,-4,-3],
      [-3,-4,-4,-5,-5,-4,-4,-3],
      [-3,-4,-4,-5,-5,-4,-4,-3],
      [-3,-4,-4,-5,-5,-4,-4,-3],
      [-2,-3,-3,-4,-4,-3,-3,-2],
      [-1,-2,-2,-2,-2,-2,-2,-1],
      [2,2,0,0,0,0,2,2],
      [2,3,1,0,0,1,3,2]
    ]
  } as any;

  const evaluatePosition = (g: Chess, aiIsWhite: boolean) => {
    const board = g.board();
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const type = piece.type as keyof typeof PIECE_VALUES;
        const val = PIECE_VALUES[type];
        const table = pieceSquareTables[type];
        const pst = table ? (piece.color === 'w' ? table[7 - r][c] : -table[r][c]) : 0;
        const s = (piece.color === 'w' ? 1 : -1) * (val + pst * 10);
        score += s;
      }
    }
    // Mobility
    const myMoves = g.moves().length;
    // Switch side and count opponent mobility
    // Rough estimate by flipping turn using FEN clone
    const oppG = new Chess(g.fen());
    const oppMoves = oppG.moves().length;
    score += (myMoves - oppMoves) * 0.5;

    // Anti-repetition penalty
    const fen = g.fen();
    const repeats = repetitionRef.current[fen] || 0;
    score -= repeats * 5;
    // Option B: soft penalty if position is in recent history to encourage progress
    if (recentFensRef.current.includes(fen)) {
      score -= 20;
    }
    // Phase 2: threefold awareness — extra penalty if this would be third time
    const count = fenCountsRef.current.get(fen) || 0;
    if (count >= 2) score -= 50;

    return aiIsWhite ? score : -score;
  };

  const orderMoves = (g: Chess, moves: any[]) => {
    // Option B: captures first, then checking moves, then promotions/others
    return moves.sort((a, b) => {
      const ac = (a.flags || '').includes('c') ? 1 : 0;
      const bc = (b.flags || '').includes('c') ? 1 : 0;
      if (ac !== bc) return bc - ac;
      // Compute check-effect cheaply by applying
      const checkRank = (m: any) => {
        try {
          const clone = new Chess(g.fen());
          clone.move({ from: m.from, to: m.to, promotion: (m.promotion || 'q') });
          return clone.inCheck() ? 1 : 0;
        } catch { return 0; }
      };
      const ach = checkRank(a);
      const bch = checkRank(b);
      if (ach !== bch) return bch - ach;
      const ap = (a.promotion ? 1 : 0);
      const bp = (b.promotion ? 1 : 0);
      if (ap !== bp) return bp - ap;
      return 0;
    });
  };

  const searchBestMove = (root: Chess, maxDepth: number, maxTimeMs: number, aiColor: 'w' | 'b', recentFens?: string[]) => {
    const start = performance.now();
    let bestMove: any = null;
    let bestScore = -Infinity;

    const aiIsWhite = aiColor === 'w';

    const minimax = (g: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number => {
      if (depth === 0 || g.isGameOver()) {
        return evaluatePosition(g, aiIsWhite);
      }
      // Time check
      if (performance.now() - start > maxTimeMs) {
        return evaluatePosition(g, aiIsWhite);
      }
      const moves = orderMoves(g, g.moves({ verbose: true } as any));
      if (maximizing) {
        let value = -Infinity;
        for (const m of moves) {
          const clone = new Chess(g.fen());
          clone.move({ from: m.from, to: m.to, promotion: (m.promotion || 'q') });
          // Option A: penalize returning to recent FENs
          const nextFen = clone.fen();
          let sc = minimax(clone, depth - 1, alpha, beta, false);
          if (recentFens && recentFens.includes(nextFen)) sc -= 150;
          const cnt = fenCountsRef.current.get(nextFen) || 0;
          if (cnt >= 2) sc -= 200;
          if (sc > value) value = sc;
          if (value > alpha) alpha = value;
          if (alpha >= beta) break;
        }
        return value;
      } else {
        let value = Infinity;
        for (const m of moves) {
          const clone = new Chess(g.fen());
          clone.move({ from: m.from, to: m.to, promotion: (m.promotion || 'q') });
          const nextFen = clone.fen();
          let sc = minimax(clone, depth - 1, alpha, beta, true);
          if (recentFens && recentFens.includes(nextFen)) sc += 150; // minimize branch: make it worse for us by opponent repeating
          const cnt = fenCountsRef.current.get(nextFen) || 0;
          if (cnt >= 2) sc += 200;
          if (sc < value) value = sc;
          if (value < beta) beta = value;
          if (alpha >= beta) break;
        }
        return value;
      }
    };

    // Iterative deepening
    const legal = orderMoves(root, root.moves({ verbose: true } as any));
    for (let depth = 1; depth <= maxDepth; depth++) {
      if (performance.now() - start > maxTimeMs) break;
      // Option A: avoid exploring moves that immediately repeat recent positions unless no alternatives
      const legalFiltered = (() => {
        try {
          const lf = legal.filter(m => {
            const c = new Chess(root.fen());
            c.move({ from: m.from, to: m.to, promotion: (m.promotion || 'q') });
            const f = c.fen();
            return !(recentFens && recentFens.includes(f));
          });
          return lf.length > 0 ? lf : legal;
        } catch { return legal; }
      })();
      for (const m of legalFiltered) {
        if (performance.now() - start > maxTimeMs) break;
        const clone = new Chess(root.fen());
        clone.move({ from: m.from, to: m.to, promotion: (m.promotion || 'q') });
        let sc = minimax(clone, depth - 1, -Infinity, Infinity, false);
        const f2 = clone.fen();
        if (recentFens && recentFens.includes(f2)) sc -= 150;
        const c2 = fenCountsRef.current.get(f2) || 0;
        if (c2 >= 2) sc -= 200;
        if (sc > bestScore || !bestMove) {
          bestScore = sc;
          bestMove = m;
        }
      }
    }
    return bestMove;
  };

  const pickMoveForDifficulty = (root: Chess, diff: Difficulty, aiColor: 'w' | 'b') => {
    const legalVerbose = orderMoves(root, root.moves({ verbose: true } as any));
    if (!legalVerbose.length) return null;
    // Option A: filter out moves that return to recent FENs if there are alternatives
    const legalNonRepeating = (() => {
      try {
        const lf = legalVerbose.filter(m => {
          const c = new Chess(root.fen());
          c.move({ from: m.from, to: m.to, promotion: (m.promotion || 'q') });
          const f = c.fen();
          const recent = !recentFensRef.current.includes(f);
          const tfold = (fenCountsRef.current.get(f) || 0) < 2;
          return recent && tfold;
        });
        return lf.length > 0 ? lf : legalVerbose;
      } catch { return legalVerbose; }
    })();
    if (diff === 'easy') {
      const blunder = Math.random() < ENGINE_PROFILES.easy.allowBlunder;
      if (blunder) {
        const tail = Math.max(1, Math.min(3, legalNonRepeating.length));
        const pool = legalNonRepeating.slice(-tail);
        return pool[Math.floor(Math.random() * pool.length)];
      }
      const pool = legalNonRepeating.slice(0, Math.max(1, Math.min(3, legalNonRepeating.length)));
      return pool[Math.floor(Math.random() * pool.length)];
    }
    if (diff === 'medium') {
      const best = searchBestMove(root, ENGINE_PROFILES.medium.maxDepth, ENGINE_PROFILES.medium.movetime, aiColor, recentFensRef.current) || legalNonRepeating[0];
      if (Math.random() < ENGINE_PROFILES.medium.variety && legalNonRepeating.length > 1) {
        return legalNonRepeating[1];
      }
      return best;
    }
    if (diff === 'hard') {
      return searchBestMove(root, ENGINE_PROFILES.hard.maxDepth, ENGINE_PROFILES.hard.movetime, aiColor, recentFensRef.current) || legalNonRepeating[0];
    }
    // master
    return searchBestMove(root, ENGINE_PROFILES.master.maxDepth, ENGINE_PROFILES.master.movetime, aiColor, recentFensRef.current) || legalNonRepeating[0];
  };

  const showAIRemark = (type: 'game' | 'victory' = 'game') => {
    let remarks: string[];
    
    if (type === 'victory') {
      const isPlayerWin = (game.turn() === 'w' && playerColor === 'black') || (game.turn() === 'b' && playerColor === 'white');
      const isDraw = game.isDraw();
      remarks = getVictoryRemarks(isPlayerWin, isDraw, language);
    } else {
      remarks = getAIRemarks(difficulty, language);
    }
    
    let randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
    if (randomRemark === lastRemarkRef.current && remarks.length > 1) {
      randomRemark = remarks[(remarks.indexOf(randomRemark) + 1) % remarks.length];
    }
    setCurrentAIRemark(randomRemark);
    lastRemarkRef.current = randomRemark;
    
    setTimeout(() => {
      setCurrentAIRemark('');
    }, type === 'victory' ? 5000 : 3000);
  };

  const makeAIMove = useCallback(() => {
    if (gameOver || isPlayerTurn) return;
    setIsAIThinking(true);
    const gameCopy = new Chess(game.fen());
    const aiColor: 'w' | 'b' = playerColor === 'white' ? 'b' : 'w';
    if (gameCopy.turn() !== aiColor) { setIsAIThinking(false); return; }

    const maxDepth = difficulty === 'master' ? 7 : difficulty === 'hard' ? 5 : difficulty === 'medium' ? 3 : 1;
    const maxTimeMs = difficulty === 'master' ? 1500 : difficulty === 'hard' ? 700 : difficulty === 'medium' ? 250 : 120;

    const minThinkMs = difficulty === 'master' ? 2200 : difficulty === 'hard' ? 2000 : difficulty === 'medium' ? 1500 : 1000;
    const startedAt = performance.now();

    setTimeout(() => {
      try {
        (async () => {
          // Use in-house move selection only (engine removed)
          const best = pickMoveForDifficulty(gameCopy, difficulty, aiColor);
          if (!best) {
            const moves = gameCopy.moves();
            if (moves.length > 0) {
              gameCopy.move(moves[Math.floor(Math.random() * moves.length)]);
            }
          } else {
            gameCopy.move({ from: best.from, to: best.to, promotion: (best.promotion || 'q') });
          }

          const elapsed = performance.now() - startedAt;
          const waitMore = Math.max(0, minThinkMs - elapsed);
          window.setTimeout(() => {
            setGame(gameCopy);
            setIsAIThinking(false);
            // Option A: record AI resulting FEN into recent buffer
            try {
              recentFensRef.current.push(gameCopy.fen());
              while (recentFensRef.current.length > 20) recentFensRef.current.shift();
              const f = gameCopy.fen();
              fenCountsRef.current.set(f, (fenCountsRef.current.get(f) || 0) + 1);
            } catch {}
            if (!gameCopy.isGameOver() && gameCopy.inCheck()) {
              setCheckBanner(language === 'ar' ? '⚠️ كش!' : '⚠️ Check!');
              try {
                const board = gameCopy.board();
                let kingSq: string | null = null;
                for (let r = 0; r < 8; r++) {
                  for (let c = 0; c < 8; c++) {
                    const p = board[r][c];
                    if (p && p.type === 'k' && p.color === gameCopy.turn()) {
                      const files = 'abcdefgh';
                      kingSq = `${files[c]}${8 - r}`;
                      break;
                    }
                  }
                }
                setCheckedSquare(kingSq);
                window.setTimeout(() => setCheckedSquare(null), 2000);
              } catch {}
              window.setTimeout(() => setCheckBanner(''), 2000);
            }
            if (gameCopy.isGameOver()) {
              setGameOver(true);
              if (gameCopy.isCheckmate()) {
                setMateBanner(language === 'ar' ? 'كش مات 👑' : 'CHECKMATE 👑');
              }
              setTimeout(() => showAIRemark('victory'), 500);
            } else {
              setIsPlayerTurn(true);
              if (Math.random() < 0.25) setTimeout(() => showAIRemark('game'), 300);
            }
          }, waitMore);
        })();
      } catch (err) {
        console.error('AI move failed', err);
        setIsAIThinking(false);
      }
    }, 0);
  }, [game, gameOver, isPlayerTurn, difficulty, playerColor]);

  useEffect(() => {
    if (gameStarted && !isPlayerTurn && !gameOver) {
      makeAIMove();
    }
  }, [gameStarted, isPlayerTurn, gameOver, makeAIMove]);

  // New tap-to-move system
  const onSquareClick = (square: string) => {
    if (!gameStarted || !isPlayerTurn || gameOver) return;

    const gameCopy = new Chess(game.fen());
    const piece = gameCopy.get(square as any);

    // If no piece is selected
    if (!selectedSquare) {
      // Only select if it's the player's piece
      if (piece && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
        setSelectedSquare(square);
        // Get valid moves for this piece
        const moves = gameCopy.moves({ square: square as any, verbose: true });
        setValidMoves(moves.map(move => move.to));
      }
      return;
    }

    // If clicking on the same square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setValidMoves([]);
    repetitionRef.current = {};
    lastPlayerFenRef.current = null;
      return;
    }

    // If clicking on another piece of the same color, select it instead
    if (piece && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
      setSelectedSquare(square);
      const moves = gameCopy.moves({ square: square as any, verbose: true });
      setValidMoves(moves.map(move => move.to));
      return;
    }

    // Try to make a move
    try {
      const move = gameCopy.move({
        from: selectedSquare,
        to: square,
        promotion: 'q'
      });
      
      if (move) {
        setGame(gameCopy);
        setSelectedSquare(null);
        setValidMoves([]);
        setIsPlayerTurn(false);
        lastPlayerFenRef.current = gameCopy.fen();
        // Option A: track recent FENs including player's positions
        try {
          recentFensRef.current.push(gameCopy.fen());
          while (recentFensRef.current.length > 20) recentFensRef.current.shift();
          const f = gameCopy.fen();
          fenCountsRef.current.set(f, (fenCountsRef.current.get(f) || 0) + 1);
        } catch {}
        if (!gameCopy.isGameOver() && gameCopy.inCheck()) {
          setCheckBanner(language === 'ar' ? '⚠️ كش!' : '⚠️ Check!');
          try {
            const board = gameCopy.board();
            let kingSq: string | null = null;
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p && p.type === 'k' && p.color === gameCopy.turn()) {
                  const files = 'abcdefgh';
                  kingSq = `${files[c]}${8 - r}`;
                  break;
                }
              }
            }
            setCheckedSquare(kingSq);
            window.setTimeout(() => setCheckedSquare(null), 2000);
          } catch {}
          window.setTimeout(() => setCheckBanner(''), 2000);
        }
        
        if (gameCopy.isGameOver()) {
          setGameOver(true);
          if (gameCopy.isCheckmate()) {
            setMateBanner(language === 'ar' ? 'كش مات 👑' : 'CHECKMATE 👑');
          }
          setTimeout(() => showAIRemark('victory'), 500);
        }
      }
    } catch (error) {
      // Invalid move, just clear selection
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const startGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGameStarted(true);
    setGameOver(false);
    setIsPlayerTurn(playerColor === 'white');
    setCurrentAIRemark('');
    setSelectedSquare(null);
    setValidMoves([]);
    
    // If player chose black, AI (white) moves first
    if (playerColor === 'black') {
      setIsPlayerTurn(false);
    }
  };

  // Fixed: Play Again function that restarts without going to setup
  const playAgain = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGameOver(false);
    setIsPlayerTurn(playerColor === 'white');
    setCurrentAIRemark('');
    setSelectedSquare(null);
    setValidMoves([]);
    setIsAIThinking(false);
    
    // If player chose black, AI (white) moves first
    if (playerColor === 'black') {
      setIsPlayerTurn(false);
    }
  };

  const restartGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGameStarted(false);
    setGameOver(false);
    setIsPlayerTurn(true);
    setCurrentAIRemark('');
    setSelectedSquare(null);
    setValidMoves([]);
  };

  const getDifficultyLabel = (diff: Difficulty): TranslationKey => {
    const difficultyMap: Record<Difficulty, TranslationKey> = {
      easy: 'difficulty_easy',
      medium: 'difficulty_medium',
      hard: 'difficulty_hard',
      master: 'difficulty_hard'
    };
    return difficultyMap[diff];
  };

  if (!gameStarted) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('choose_color', language)}
            </label>
            <div className="flex gap-2">
              <Button
                variant={playerColor === 'white' ? 'default' : 'outline'}
                onTouchStart={() => setPlayerColor('white')}
                onClick={() => setPlayerColor('white')}
                className="flex-1 min-h-[48px]"
              >
                ⚪ {t('white', language)}
              </Button>
              <Button
                variant={playerColor === 'black' ? 'default' : 'outline'}
                onTouchStart={() => setPlayerColor('black')}
                onClick={() => setPlayerColor('black')}
                className="flex-1 min-h-[48px]"
              >
                ⚫ {t('black', language)}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('difficulty', language)}
            </label>
            <Select value={difficulty} onValueChange={(value: Difficulty) => setDifficulty(value)}>
              <SelectTrigger className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t('difficulty_easy', language)}</SelectItem>
                <SelectItem value="medium">{t('difficulty_medium', language)}</SelectItem>
                <SelectItem value="hard">{t('difficulty_hard', language)}</SelectItem>
                <SelectItem value="master">{language === 'ar' ? 'الماستر' : 'Master'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={startGame} className="w-full min-h-[48px]">
          {t('start_game', language)}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      <style>{`
        @keyframes waktiShimmer { 0% { box-shadow: 0 0 0 2px rgba(239,68,68,0.9) inset, 0 0 8px rgba(239,68,68,0.6); }
          50% { box-shadow: 0 0 0 2px rgba(239,68,68,0.6) inset, 0 0 18px rgba(239,68,68,0.9); }
          100% { box-shadow: 0 0 0 2px rgba(239,68,68,0.9) inset, 0 0 8px rgba(239,68,68,0.6); } }
      `}</style>
      {/* Game Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <h3 className="text-lg font-bold">
            Chess
          </h3>
          {currentAIRemark && (
            <div className="bg-amber-100 dark:bg-amber-900/20 px-3 py-1 rounded-full text-sm text-amber-700 dark:text-amber-300 animate-fade-in max-w-xs">
              🤖 {currentAIRemark}
            </div>
          )}
          {checkBanner && (
            <div className="bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full text-sm text-red-700 dark:text-red-300 animate-fade-in max-w-xs">
              {checkBanner}
            </div>
          )}
          {mateBanner && (
            <div className="bg-red-200 dark:bg-red-900/50 px-3 py-1.5 rounded-full text-sm font-bold text-red-800 dark:text-red-200 animate-pulse max-w-xs">
              {mateBanner}
            </div>
          )}
        </div>
        
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {language === 'ar' ? `أنت: ${playerColor === 'white' ? 'أبيض' : 'أسود'}` : `You: ${playerColor}`} | 
          {language === 'ar' ? ` الذكاء الاصطناعي: ${playerColor === 'white' ? 'أسود' : 'أبيض'}` : ` AI: ${playerColor === 'white' ? 'black' : 'white'}`}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          {t('difficulty', language)}: {difficulty === 'master' ? (language === 'ar' ? 'الماستر' : 'Master') : t(getDifficultyLabel(difficulty), language)}
        </p>
      </div>

      <div className="flex justify-center overflow-x-auto">
        <div className="w-full max-w-md">
          <Chessboard
            position={game.fen()}
            onSquareClick={onSquareClick}
            boardOrientation={playerColor}
            arePiecesDraggable={false}
            animationDuration={300}
            customSquareStyles={{
              ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } } : {}),
              ...validMoves.reduce((acc, square) => ({
                ...acc,
                [square]: { backgroundColor: 'rgba(0, 255, 0, 0.3)' }
              }), {}),
              ...(checkedSquare ? { [checkedSquare]: { outline: '2px solid rgba(239,68,68,0.9)', outlineOffset: '-2px', animation: 'waktiShimmer 1s infinite' } } : {})
            }}
            customBoardStyle={{
              borderRadius: '4px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
            }}
          />
        </div>
      </div>

      {gameOver && (
        <div className="text-center space-y-4">
          <p className="text-xl font-bold text-green-600">
            {game.isCheckmate() 
              ? ((game.turn() === 'w' && playerColor === 'black') || (game.turn() === 'b' && playerColor === 'white'))
                ? t('victory_checkmate_player', language)
                : t('victory_checkmate_ai', language)
              : t('victory_draw', language)
            }
          </p>
          <Button onClick={playAgain} className="min-h-[48px]">
            {t('play_again', language)}
          </Button>
        </div>
      )}

      {!gameOver && (
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isAIThinking 
              ? t('ai_calculating', language)
              : isPlayerTurn 
              ? selectedSquare
                ? `${t('your_turn', language)} - ${t('tap_square', language)} ${language === 'ar' ? 'للحركة' : 'to move'}`
                : `${t('your_turn', language)} - ${t('tap_piece_destination', language)}`
              : t('ai_turn', language)
            }
          </p>
          {isAIThinking && (
            <div className="flex justify-center mt-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={playAgain} className="flex-1 min-h-[48px]">
          {t('restart', language)}
        </Button>
        <Button
          variant="outline"
          onClick={() => { setGameStarted(false); setMateBanner(''); setCheckBanner(''); setCheckedSquare(null); setCurrentAIRemark(''); onBack(); }}
          className="flex-1 min-h-[48px]"
        >
          {t('back', language)}
        </Button>
      </div>
    </div>
  );
}
