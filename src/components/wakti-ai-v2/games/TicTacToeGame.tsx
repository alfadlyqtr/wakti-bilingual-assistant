
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface TicTacToeGameProps {
  onBack: () => void;
}

type Player = 'X' | 'O' | null;
type Board = Player[];
type Difficulty = 'easy' | 'medium' | 'hard';

const getAIRemarks = (difficulty: Difficulty, language: string) => {
  const remarkKeys = {
    easy: ['ttt_easy_messing', 'ttt_easy_oops', 'ttt_easy_what_happened', 'ttt_easy_random', 'ttt_easy_confused'],
    medium: ['ttt_medium_nice_block', 'ttt_medium_almost', 'ttt_medium_again', 'ttt_medium_tricky', 'ttt_medium_watching'],
    hard: ['ttt_hard_cant_beat', 'ttt_hard_saw_moves', 'ttt_hard_last_chance', 'ttt_hard_perfect', 'ttt_hard_impossible']
  };
  return remarkKeys[difficulty].map(key => t(key, language));
};

const getVictoryRemarks = (winner: Player | 'draw', playerSymbol: 'X' | 'O', language: string) => {
  if (winner === 'draw') return [t('victory_draw', language)];
  if (winner === playerSymbol) return [t('victory_player_win', language)];
  return [t('victory_ai_win', language)];
};

export function TicTacToeGame({ onBack }: TicTacToeGameProps) {
  const { language } = useTheme();
  
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O'>('X');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentAIRemark, setCurrentAIRemark] = useState<string>('');
  const [isAIThinking, setIsAIThinking] = useState(false);

  const checkWinner = (currentBoard: Board): Player | 'draw' | null => {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return currentBoard[a];
      }
    }

    if (currentBoard.every(cell => cell !== null)) {
      return 'draw';
    }

    return null;
  };

  const getAIMove = (currentBoard: Board, aiSymbol: 'X' | 'O'): number => {
    const availableMoves = currentBoard
      .map((cell, index) => cell === null ? index : null)
      .filter(val => val !== null) as number[];

    if (availableMoves.length === 0) return -1;

    const playerSymbol = aiSymbol === 'X' ? 'O' : 'X';

    switch (difficulty) {
      case 'easy':
        // 100% random moves
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
      
      case 'medium':
        // Win/block priority with center/corner strategy
        // Try to win first
        for (const move of availableMoves) {
          const testBoard = [...currentBoard];
          testBoard[move] = aiSymbol;
          if (checkWinner(testBoard) === aiSymbol) {
            return move;
          }
        }
        
        // Block player from winning
        for (const move of availableMoves) {
          const testBoard = [...currentBoard];
          testBoard[move] = playerSymbol;
          if (checkWinner(testBoard) === playerSymbol) {
            return move;
          }
        }
        
        // Take center if available
        if (availableMoves.includes(4)) return 4;
        
        // Take corners
        const corners = [0, 2, 6, 8].filter(i => availableMoves.includes(i));
        if (corners.length > 0) {
          return corners[Math.floor(Math.random() * corners.length)];
        }
        
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
      
      case 'hard':
        // Perfect minimax algorithm
        const minimax = (board: Board, depth: number, isMaximizing: boolean): number => {
          const result = checkWinner(board);
          
          if (result === aiSymbol) return 10 - depth;
          if (result === playerSymbol) return depth - 10;
          if (result === 'draw') return 0;
          
          const moves = board
            .map((cell, index) => cell === null ? index : null)
            .filter(val => val !== null) as number[];

          if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
              board[move] = aiSymbol;
              const evaluation = minimax(board, depth + 1, false);
              board[move] = null;
              maxEval = Math.max(maxEval, evaluation);
            }
            return maxEval;
          } else {
            let minEval = Infinity;
            for (const move of moves) {
              board[move] = playerSymbol;
              const evaluation = minimax(board, depth + 1, true);
              board[move] = null;
              minEval = Math.min(minEval, evaluation);
            }
            return minEval;
          }
        };
        
        let bestMove = availableMoves[0];
        let bestScore = -Infinity;
        
        for (const move of availableMoves) {
          const testBoard = [...currentBoard];
          testBoard[move] = aiSymbol;
          const score = minimax(testBoard, 0, false);
          if (score > bestScore) {
            bestScore = score;
            bestMove = move;
          }
        }
        
        return bestMove;
      
      default:
        return availableMoves[0];
    }
  };

  const showAIRemark = (type: 'game' | 'victory' = 'game') => {
    let remarks: string[];
    
    if (type === 'victory') {
      remarks = getVictoryRemarks(winner, playerSymbol, language);
    } else {
      remarks = getAIRemarks(difficulty, language);
    }
    
    const randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
    setCurrentAIRemark(randomRemark);
    
    setTimeout(() => {
      setCurrentAIRemark('');
    }, type === 'victory' ? 4000 : 2500);
  };

  const makeMove = (index: number) => {
    if (board[index] || gameOver || !isPlayerTurn || !gameStarted) return;

    const newBoard = [...board];
    newBoard[index] = playerSymbol;
    setBoard(newBoard);
    setIsPlayerTurn(false);

    const gameResult = checkWinner(newBoard);
    if (gameResult) {
      setWinner(gameResult);
      setGameOver(true);
      setTimeout(() => showAIRemark('victory'), 300);
      return;
    }

    // AI move with instant response (under 300ms)
    setIsAIThinking(true);
    const thinkingTime = 150 + Math.random() * 100; // 150-250ms
    
    setTimeout(() => {
      const aiSymbol = playerSymbol === 'X' ? 'O' : 'X';
      const aiMove = getAIMove(newBoard, aiSymbol);
      
      if (aiMove !== -1) {
        const aiBoard = [...newBoard];
        aiBoard[aiMove] = aiSymbol;
        setBoard(aiBoard);
        
        const aiGameResult = checkWinner(aiBoard);
        if (aiGameResult) {
          setWinner(aiGameResult);
          setGameOver(true);
          setTimeout(() => showAIRemark('victory'), 300);
        } else {
          setIsPlayerTurn(true);
          // Show game remark occasionally (30% chance)
          if (Math.random() < 0.3) {
            setTimeout(() => showAIRemark('game'), 200);
          }
        }
      }
      
      setIsAIThinking(false);
    }, thinkingTime);
  };

  const startGame = () => {
    setGameStarted(true);
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(playerSymbol === 'X');
    setGameOver(false);
    setWinner(null);
    setCurrentAIRemark('');
    
    // If player chose O, AI goes first
    if (playerSymbol === 'O') {
      setTimeout(() => {
        const aiMove = getAIMove(Array(9).fill(null), 'X');
        const newBoard = Array(9).fill(null);
        newBoard[aiMove] = 'X';
        setBoard(newBoard);
        setIsPlayerTurn(true);
      }, 200);
    }
  };

  const restartGame = () => {
    setGameStarted(false);
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameOver(false);
    setWinner(null);
    setCurrentAIRemark('');
  };

  const getWinnerMessage = () => {
    if (winner === 'draw') {
      return t('victory_draw', language);
    }
    if (winner === playerSymbol) {
      return t('victory_player_win', language);
    }
    return t('victory_ai_win', language);
  };

  if (!gameStarted) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('choose_symbol', language)}
            </label>
            <div className="flex gap-2">
              <Button
                variant={playerSymbol === 'X' ? 'default' : 'outline'}
                onTouchStart={() => setPlayerSymbol('X')}
                onClick={() => setPlayerSymbol('X')}
                className="flex-1 min-h-[48px]"
              >
                X
              </Button>
              <Button
                variant={playerSymbol === 'O' ? 'default' : 'outline'}
                onTouchStart={() => setPlayerSymbol('O')}
                onClick={() => setPlayerSymbol('O')}
                className="flex-1 min-h-[48px]"
              >
                O
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
            Tic-Tac-Toe
          </h3>
          {currentAIRemark && (
            <div className="bg-blue-100 dark:bg-blue-900/20 px-3 py-1 rounded-full text-sm text-blue-700 dark:text-blue-300 animate-fade-in max-w-xs">
              🤖 {currentAIRemark}
            </div>
          )}
        </div>
        
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {language === 'ar' ? `أنت: ${playerSymbol}` : `You: ${playerSymbol}`} | 
          {language === 'ar' ? ` الذكاء الاصطناعي: ${playerSymbol === 'X' ? 'O' : 'X'}` : ` AI: ${playerSymbol === 'X' ? 'O' : 'X'}`}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          {t('difficulty', language)}: {t(`difficulty_${difficulty}`, language)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {board.map((cell, index) => (
          <Button
            key={index}
            variant="outline"
            className="h-20 w-20 text-3xl font-bold transition-all duration-200 active:scale-95 hover:bg-slate-100 dark:hover:bg-slate-800 select-none touch-manipulation"
            onTouchStart={() => makeMove(index)}
            onClick={() => makeMove(index)}
            disabled={!!cell || gameOver || !isPlayerTurn}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {cell}
          </Button>
        ))}
      </div>

      {gameOver && (
        <div className="text-center space-y-4">
          <p className="text-xl font-bold text-green-600">
            {getWinnerMessage()}
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
              ? t('ai_thinking', language)
              : isPlayerTurn 
              ? `${t('your_turn', language)} - ${t('tap_square', language)}`
              : t('ai_turn', language)
            }
          </p>
          {isAIThinking && (
            <div className="flex justify-center mt-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
