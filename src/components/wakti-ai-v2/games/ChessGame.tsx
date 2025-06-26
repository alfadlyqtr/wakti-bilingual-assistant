import React, { useState, useEffect, useCallback } from 'react';
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

  const evaluatePosition = (game: Chess): number => {
    let score = 0;
    const board = game.board();
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const pieceValue = PIECE_VALUES[piece.type];
          if (piece.color === 'w') {
            score += pieceValue;
          } else {
            score -= pieceValue;
          }
        }
      }
    }

    // Add bonus for checkmate/check
    if (game.isCheckmate()) {
      return game.turn() === 'w' ? -50000 : 50000;
    }
    if (game.isCheck()) {
      score += game.turn() === 'w' ? -50 : 50;
    }

    return score;
  };

  const getAIMove = (currentGame: Chess): string | null => {
    const possibleMoves = currentGame.moves();
    if (possibleMoves.length === 0) return null;

    const aiColor = playerColor === 'white' ? 'black' : 'white';
    const isAIWhite = aiColor === 'white';

    switch (difficulty) {
      case 'easy':
        // 100% random legal moves
        return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      
      case 'medium':
        // Basic evaluation with material counting
        let bestMove = possibleMoves[0];
        let bestScore = isAIWhite ? -Infinity : Infinity;
        
        for (const move of possibleMoves) {
          const gameCopy = new Chess(currentGame.fen());
          gameCopy.move(move);
          const score = evaluatePosition(gameCopy);
          
          if (isAIWhite ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = move;
          }
        }
        
        return bestMove;
      
      case 'hard':
        // Minimax with alpha-beta pruning (depth 2)
        const minimax = (game: Chess, depth: number, isMaximizing: boolean, alpha: number = -Infinity, beta: number = Infinity): number => {
          if (depth === 0 || game.isGameOver()) {
            return evaluatePosition(game);
          }
          
          const moves = game.moves();
          
          if (isMaximizing) {
            let maxEvaluation = -Infinity;
            for (const move of moves) {
              const gameCopy = new Chess(game.fen());
              gameCopy.move(move);
              const evaluation = minimax(gameCopy, depth - 1, false, alpha, beta);
              maxEvaluation = Math.max(maxEvaluation, evaluation);
              alpha = Math.max(alpha, evaluation);
              if (beta <= alpha) break;
            }
            return maxEvaluation;
          } else {
            let minEvaluation = Infinity;
            for (const move of moves) {
              const gameCopy = new Chess(game.fen());
              gameCopy.move(move);
              const evaluation = minimax(gameCopy, depth - 1, true, alpha, beta);
              minEvaluation = Math.min(minEvaluation, evaluation);
              beta = Math.min(beta, evaluation);
              if (beta <= alpha) break;
            }
            return minEvaluation;
          }
        };
        
        let bestHardMove = possibleMoves[0];
        let bestHardScore = isAIWhite ? -Infinity : Infinity;
        
        for (const move of possibleMoves) {
          const gameCopy = new Chess(currentGame.fen());
          gameCopy.move(move);
          const score = minimax(gameCopy, 2, !isAIWhite);
          
          if (isAIWhite ? score > bestHardScore : score < bestHardScore) {
            bestHardScore = score;
            bestMove = move;
          }
        }
        
        return bestHardMove;
      
      default:
        return possibleMoves[0];
    }
  };

  const getAIThinkingTime = (difficulty: Difficulty): number => {
    switch (difficulty) {
      case 'easy': return 400 + Math.random() * 200; // 400-600ms
      case 'medium': return 600 + Math.random() * 300; // 600-900ms
      case 'hard': return 800 + Math.random() * 400; // 800-1200ms
      default: return 600;
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
    
    setIsAIThinking(true);
    const thinkingTime = getAIThinkingTime(difficulty);
    
    setTimeout(() => {
      const aiMove = getAIMove(game);
      if (aiMove) {
        const gameCopy = new Chess(game.fen());
        try {
          gameCopy.move(aiMove);
          setGame(gameCopy);
          
          if (gameCopy.isGameOver()) {
            setGameOver(true);
            setTimeout(() => showAIRemark('victory'), 500);
          } else {
            setIsPlayerTurn(true);
            
            // Show AI remark occasionally (25% chance)
            if (Math.random() < 0.25) {
              setTimeout(() => showAIRemark('game'), 300);
            }
          }
        } catch (error) {
          console.error('Invalid AI move:', error);
        }
      }
      setIsAIThinking(false);
    }, thinkingTime);
  }, [game, gameOver, isPlayerTurn, difficulty]);

  useEffect(() => {
    if (gameStarted && !isPlayerTurn && !gameOver) {
      makeAIMove();
    }
  }, [gameStarted, isPlayerTurn, gameOver, makeAIMove]);

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (!gameStarted || !isPlayerTurn || gameOver) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });
      
      if (move) {
        setGame(gameCopy);
        setIsPlayerTurn(false);
        
        if (gameCopy.isGameOver()) {
          setGameOver(true);
          setTimeout(() => showAIRemark('victory'), 500);
        }
        
        return true;
      }
    } catch (error) {
      return false;
    }
    
    return false;
  };

  const startGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGameStarted(true);
    setGameOver(false);
    setIsPlayerTurn(playerColor === 'white');
    setCurrentAIRemark('');
    
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
            onPieceDrop={onDrop}
            boardOrientation={playerColor}
            arePiecesDraggable={!gameOver && isPlayerTurn}
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
          <Button onClick={restartGame} className="min-h-[48px]">
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
              ? `${t('your_turn', language)} - ${t('tap_piece_destination', language)}`
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
