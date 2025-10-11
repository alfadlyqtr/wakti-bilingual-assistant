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

type Difficulty = 'easy' | 'medium' | 'hard';
type PlayerColor = 'white' | 'black';

const getAIRemarks = (difficulty: Difficulty, language: string) => {
  const remarkKeys: Record<Difficulty, TranslationKey[]> = {
    easy: ['chess_easy_nice_move', 'chess_easy_didnt_see', 'chess_easy_oops', 'chess_easy_learning', 'chess_easy_mistake'],
    medium: ['chess_medium_sure', 'chess_medium_interesting', 'chess_medium_solid', 'chess_medium_thinking', 'chess_medium_challenge'],
    hard: ['chess_hard_wont_survive', 'chess_hard_simulation', 'chess_hard_try_again', 'chess_hard_calculated', 'chess_hard_inevitable']
  };
  return remarkKeys[difficulty].map(key => t(key, language));
};

const getVictoryRemarks = (isPlayerWin: boolean, isDraw: boolean, language: string) => {
  if (isDraw) return [t('victory_draw', language)];
  if (isPlayerWin) return [t('victory_checkmate_player', language)];
  return [t('victory_checkmate_ai', language)];
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
  // Stockfish worker ref
  const engineWorkerRef = useRef<Worker | null>(null);
  
  // New states for tap-to-move system
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  // Initialize engine worker once
  useEffect(() => {
    if (!engineWorkerRef.current) {
      try {
        engineWorkerRef.current = new Worker(
          new URL('../../../workers/chessEngine.worker.ts', import.meta.url),
          { type: 'classic' }
        );
      } catch (e) {
        console.error('Failed to create chess engine worker', e);
      }
    }

    return () => {
      try {
        engineWorkerRef.current?.postMessage({ type: 'terminate' });
        engineWorkerRef.current?.terminate();
      } catch {}
      engineWorkerRef.current = null;
    };
  }, []);

  // Parse Stockfish bestmove like "e2e4" or "e7e8q"
  const applyBestMove = (uci: string) => {
    if (!uci || uci.length < 4) return;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promo = uci.length >= 5 ? uci[4] : undefined;
    const gameCopy = new Chess(game.fen());
    try {
      gameCopy.move({ from, to, promotion: (promo as any) || 'q' });
      setGame(gameCopy);
      if (gameCopy.isGameOver()) {
        setGameOver(true);
        setTimeout(() => showAIRemark('victory'), 500);
      } else {
        setIsPlayerTurn(true);
        if (Math.random() < 0.25) setTimeout(() => showAIRemark('game'), 300);
      }
    } catch (err) {
      console.error('Failed to apply engine move', uci, err);
    }
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
    
    const randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
    setCurrentAIRemark(randomRemark);
    
    setTimeout(() => {
      setCurrentAIRemark('');
    }, type === 'victory' ? 5000 : 3000);
  };

  const makeAIMove = useCallback(() => {
    if (gameOver || isPlayerTurn) return;
    const worker = engineWorkerRef.current;
    if (!worker) return;

    setIsAIThinking(true);
    let resolved = false;
    const cleanup = (onMessageRef: any, toRef: number | undefined) => {
      try { worker.removeEventListener('message', onMessageRef); } catch {}
      if (toRef) clearTimeout(toRef);
    };

    const fallbackBasic = () => {
      if (resolved) return;
      resolved = true;
      setIsAIThinking(false);
      try {
        const moves = game.moves();
        if (!moves.length) return;
        // simple fallback: pick random legal move
        const mv = moves[Math.floor(Math.random() * moves.length)];
        const gameCopy = new Chess(game.fen());
        gameCopy.move(mv);
        setGame(gameCopy);
        if (gameCopy.isGameOver()) {
          setGameOver(true);
          setTimeout(() => showAIRemark('victory'), 500);
        } else {
          setIsPlayerTurn(true);
        }
        showInfo(language === 'ar' ? 'تشغيل محرك بسيط مؤقتاً' : 'Using basic engine temporarily');
      } catch (err) {
        console.error('Fallback AI failed', err);
        showError(language === 'ar' ? 'فشل محرك الشطرنج' : 'Chess engine failed');
      }
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type: string; bestmove?: string; error?: string };
      if (data?.type === 'bestmove' && !resolved) {
        resolved = true;
        cleanup(onMessage, timeoutId as any);
        setIsAIThinking(false);
        applyBestMove(data.bestmove || '');
      } else if (data?.type === 'error' && !resolved) {
        console.warn('Engine error:', data.error);
        cleanup(onMessage, timeoutId as any);
        fallbackBasic();
      }
    };
    worker.addEventListener('message', onMessage);
    try {
      worker.postMessage({ type: 'go', fen: game.fen(), difficulty });
    } catch (err) {
      console.error('Worker postMessage failed', err);
      cleanup(onMessage, undefined);
      fallbackBasic();
    }
    // safety timeout
    const timeoutMs = difficulty === 'hard' ? 4500 : difficulty === 'medium' ? 3500 : 2500;
    const timeoutId = window.setTimeout(() => {
      if (!resolved) {
        console.warn('Engine timeout, falling back');
        cleanup(onMessage, timeoutId);
        fallbackBasic();
      }
    }, timeoutMs);
  }, [game, gameOver, isPlayerTurn, difficulty]);

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
        
        if (gameCopy.isGameOver()) {
          setGameOver(true);
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
      hard: 'difficulty_hard'
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
        </div>
        
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {language === 'ar' ? `أنت: ${playerColor === 'white' ? 'أبيض' : 'أسود'}` : `You: ${playerColor}`} | 
          {language === 'ar' ? ` الذكاء الاصطناعي: ${playerColor === 'white' ? 'أسود' : 'أبيض'}` : ` AI: ${playerColor === 'white' ? 'black' : 'white'}`}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          {t('difficulty', language)}: {t(getDifficultyLabel(difficulty), language)}
        </p>
      </div>

      <div className="flex justify-center overflow-x-auto">
        <div className="w-full max-w-md">
          <Chessboard
            position={game.fen()}
            onSquareClick={onSquareClick}
            boardOrientation={playerColor}
            arePiecesDraggable={false}
            customSquareStyles={{
              ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } } : {}),
              ...validMoves.reduce((acc, square) => ({
                ...acc,
                [square]: { backgroundColor: 'rgba(0, 255, 0, 0.3)' }
              }), {})
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
        <Button variant="outline" onClick={restartGame} className="flex-1 min-h-[48px]">
          {t('restart', language)}
        </Button>
        <Button variant="outline" onClick={onBack} className="flex-1 min-h-[48px]">
          {t('back', language)}
        </Button>
      </div>
    </div>
  );
}
