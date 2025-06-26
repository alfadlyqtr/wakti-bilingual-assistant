
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';

interface TicTacToeGameProps {
  onBack: () => void;
}

type Player = 'X' | 'O' | null;
type Board = Player[];
type Difficulty = 'easy' | 'medium' | 'hard';

const AI_REMARKS = {
  easy: [
    "I'm just clicking stuff 😅",
    "You win again?! What!",
    "Oops… was that a mistake?"
  ],
  medium: [
    "You're tricky, I like it.",
    "I was going to do that!",
    "This game's getting serious."
  ],
  hard: [
    "You won't beat me this time.",
    "Hehe... I've calculated every outcome.",
    "One wrong move... and it's mine 😈"
  ]
};

export function TicTacToeGame({ onBack }: TicTacToeGameProps) {
  const { language } = useTheme();
  const { showSuccess, showInfo } = useToastHelper();
  
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O'>('X');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  // Load saved game state
  useEffect(() => {
    const savedGame = localStorage.getItem('wakti_tictactoe_game');
    if (savedGame) {
      const gameState = JSON.parse(savedGame);
      setBoard(gameState.board);
      setIsPlayerTurn(gameState.isPlayerTurn);
      setPlayerSymbol(gameState.playerSymbol);
      setDifficulty(gameState.difficulty);
      setGameOver(gameState.gameOver);
      setWinner(gameState.winner);
      setGameStarted(gameState.gameStarted);
    }
  }, []);

  // Save game state
  useEffect(() => {
    if (gameStarted) {
      const gameState = {
        board,
        isPlayerTurn,
        playerSymbol,
        difficulty,
        gameOver,
        winner,
        gameStarted
      };
      localStorage.setItem('wakti_tictactoe_game', JSON.stringify(gameState));
    }
  }, [board, isPlayerTurn, playerSymbol, difficulty, gameOver, winner, gameStarted]);

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

    switch (difficulty) {
      case 'easy':
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
      
      case 'medium':
        // Try to win first
        for (const move of availableMoves) {
          const testBoard = [...currentBoard];
          testBoard[move] = aiSymbol;
          if (checkWinner(testBoard) === aiSymbol) {
            return move;
          }
        }
        
        // Block player from winning
        const playerSymbol = aiSymbol === 'X' ? 'O' : 'X';
        for (const move of availableMoves) {
          const testBoard = [...currentBoard];
          testBoard[move] = playerSymbol;
          if (checkWinner(testBoard) === playerSymbol) {
            return move;
          }
        }
        
        // Take center if available
        if (availableMoves.includes(4)) return 4;
        
        // Take random move
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
      
      case 'hard':
        // Minimax algorithm
        const minimax = (board: Board, depth: number, isMaximizing: boolean): number => {
          const result = checkWinner(board);
          
          if (result === aiSymbol) return 10 - depth;
          if (result === playerSymbol) return depth - 10;
          if (result === 'draw') return 0;
          
          if (isMaximizing) {
            let bestScore = -Infinity;
            for (const move of availableMoves) {
              if (board[move] === null) {
                board[move] = aiSymbol;
                const score = minimax(board, depth + 1, false);
                board[move] = null;
                bestScore = Math.max(score, bestScore);
              }
            }
            return bestScore;
          } else {
            let bestScore = Infinity;
            for (const move of availableMoves) {
              if (board[move] === null) {
                board[move] = playerSymbol;
                const score = minimax(board, depth + 1, true);
                board[move] = null;
                bestScore = Math.min(score, bestScore);
              }
            }
            return bestScore;
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
      return;
    }

    // AI move after delay
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
        } else {
          setIsPlayerTurn(true);
        }
        
        // Show AI remark
        const remarks = AI_REMARKS[difficulty];
        const randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
        showInfo(`AI: ${randomRemark}`);
      }
    }, 500);
  };

  const startGame = () => {
    setGameStarted(true);
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(playerSymbol === 'X');
    setGameOver(false);
    setWinner(null);
    
    // If player chose O, AI goes first
    if (playerSymbol === 'O') {
      setTimeout(() => {
        const aiMove = getAIMove(Array(9).fill(null), 'X');
        const newBoard = Array(9).fill(null);
        newBoard[aiMove] = 'X';
        setBoard(newBoard);
        setIsPlayerTurn(true);
      }, 500);
    }
  };

  const restartGame = () => {
    setGameStarted(false);
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameOver(false);
    setWinner(null);
    localStorage.removeItem('wakti_tictactoe_game');
  };

  const getWinnerMessage = () => {
    if (winner === 'draw') {
      return language === 'ar' ? 'تعادل!' : 'It\'s a draw!';
    }
    if (winner === playerSymbol) {
      return language === 'ar' ? 'لقد فزت!' : 'You won!';
    }
    return language === 'ar' ? 'فاز الذكاء الاصطناعي!' : 'AI won!';
  };

  if (!gameStarted) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ar' ? 'اختر رمزك:' : 'Choose your symbol:'}
            </label>
            <div className="flex gap-2">
              <Button
                variant={playerSymbol === 'X' ? 'default' : 'outline'}
                onClick={() => setPlayerSymbol('X')}
                className="flex-1"
              >
                X
              </Button>
              <Button
                variant={playerSymbol === 'O' ? 'default' : 'outline'}
                onClick={() => setPlayerSymbol('O')}
                className="flex-1"
              >
                O
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ar' ? 'مستوى الصعوبة:' : 'Difficulty:'}
            </label>
            <Select value={difficulty} onValueChange={(value: Difficulty) => setDifficulty(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{language === 'ar' ? 'سهل' : 'Easy'}</SelectItem>
                <SelectItem value="medium">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                <SelectItem value="hard">{language === 'ar' ? 'صعب' : 'Hard'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={startGame} className="w-full">
          {language === 'ar' ? 'ابدأ اللعبة' : 'Start Game'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-lg font-medium">
          {language === 'ar' ? `أنت: ${playerSymbol}` : `You: ${playerSymbol}`} | 
          {language === 'ar' ? ` الذكاء الاصطناعي: ${playerSymbol === 'X' ? 'O' : 'X'}` : ` AI: ${playerSymbol === 'X' ? 'O' : 'X'}`}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {language === 'ar' ? `الصعوبة: ${difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'}` : `Difficulty: ${difficulty}`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {board.map((cell, index) => (
          <Button
            key={index}
            variant="outline"
            className="h-16 text-2xl font-bold"
            onClick={() => makeMove(index)}
            disabled={!!cell || gameOver || !isPlayerTurn}
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
          <Button onClick={restartGame}>
            {language === 'ar' ? 'العب مرة أخرى' : 'Play Again'}
          </Button>
        </div>
      )}

      {!gameOver && (
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isPlayerTurn 
              ? (language === 'ar' ? 'دورك' : 'Your turn')
              : (language === 'ar' ? 'دور الذكاء الاصطناعي...' : 'AI thinking...')
            }
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={restartGame} className="flex-1">
          {language === 'ar' ? 'إعادة تشغيل' : 'Restart'}
        </Button>
        <Button variant="outline" onClick={onBack} className="flex-1">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    </div>
  );
}
