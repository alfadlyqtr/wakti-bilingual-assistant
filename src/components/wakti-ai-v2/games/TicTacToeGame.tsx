import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';

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
    "Oops… was that a mistake?",
    "Wait, how did you do that?",
    "I was supposed to block that!"
  ],
  medium: [
    "You're tricky, I like it.",
    "I was going to do that!",
    "This game's getting serious.",
    "Nice move... but I'm watching you.",
    "Hmm, didn't see that coming."
  ],
  hard: [
    "You won't beat me this time.",
    "Hehe... I've calculated every outcome.",
    "One wrong move... and it's mine 😈",
    "Impossible! Let me recalculate...",
    "You're better than I thought."
  ]
};

const VICTORY_REMARKS = {
  player_win: [
    "Wow! You actually beat me! 🏆",
    "Impossible! How did you win?! 😱",
    "I demand a rematch! Well played! 🎉",
    "You're too good for me! 👑",
    "Okay, I'm impressed! Victory is yours! ⭐"
  ],
  ai_win: [
    "Better luck next time! 😎",
    "I am the ultimate Tic-Tac-Toe master! 🤖",
    "Victory is mine! Want another round? 🏆"
  ],
  draw: [
    "A worthy opponent! Well fought! 🤝",
    "Neither of us could claim victory!",
    "Perfectly balanced... as all things should be."
  ]
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
  const [showVictoryBadge, setShowVictoryBadge] = useState(false);

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

    const playerSymbol = aiSymbol === 'X' ? 'O' : 'X';

    switch (difficulty) {
      case 'easy':
        // 30% chance to make optimal move, 70% random
        if (Math.random() < 0.3) {
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
        }
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
      
      case 'medium':
        // 80% chance to make optimal move
        if (Math.random() < 0.8) {
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
        }
        
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
      
      case 'hard':
        // Perfect minimax algorithm
        const minimax = (board: Board, depth: number, isMaximizing: boolean, alpha: number = -Infinity, beta: number = Infinity): number => {
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
              const evaluation = minimax(board, depth + 1, false, alpha, beta);
              board[move] = null;
              maxEval = Math.max(maxEval, evaluation);
              alpha = Math.max(alpha, evaluation);
              if (beta <= alpha) break;
            }
            return maxEval;
          } else {
            let minEval = Infinity;
            for (const move of moves) {
              board[move] = playerSymbol;
              const evaluation = minimax(board, depth + 1, true, alpha, beta);
              board[move] = null;
              minEval = Math.min(minEval, evaluation);
              beta = Math.min(beta, evaluation);
              if (beta <= alpha) break;
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

  const getAIThinkingTime = (difficulty: Difficulty): number => {
    switch (difficulty) {
      case 'easy': return 1500 + Math.random() * 1000; // 1.5-2.5s
      case 'medium': return 2000 + Math.random() * 1500; // 2-3.5s
      case 'hard': return 3000 + Math.random() * 2000; // 3-5s
      default: return 2000;
    }
  };

  const showAIRemark = (type: 'game' | 'victory' = 'game') => {
    let remarks: string[];
    
    if (type === 'victory') {
      if (winner === playerSymbol) {
        remarks = VICTORY_REMARKS.player_win;
      } else if (winner === 'draw') {
        remarks = VICTORY_REMARKS.draw;
      } else {
        remarks = VICTORY_REMARKS.ai_win;
      }
    } else {
      remarks = AI_REMARKS[difficulty];
    }
    
    const randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
    setCurrentAIRemark(randomRemark);
    
    setTimeout(() => {
      setCurrentAIRemark('');
    }, type === 'victory' ? 5000 : 3000);
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
      setShowVictoryBadge(true);
      setTimeout(() => showAIRemark('victory'), 500);
      return;
    }

    // AI move with realistic timing
    setIsAIThinking(true);
    const thinkingTime = getAIThinkingTime(difficulty);
    
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
          setShowVictoryBadge(true);
          setTimeout(() => showAIRemark('victory'), 500);
        } else {
          setIsPlayerTurn(true);
          // Show game remark occasionally
          if (Math.random() < 0.4) {
            setTimeout(() => showAIRemark('game'), 300);
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
      }, 500);
    }
  };

  const restartGame = () => {
    setGameStarted(false);
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setGameOver(false);
    setWinner(null);
    setCurrentAIRemark('');
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
              {language === 'ar' ? 'مستوى الصعوبة:' : 'Difficulty:'}
            </label>
            <Select value={difficulty} onValueChange={(value: Difficulty) => setDifficulty(value)}>
              <SelectTrigger className="min-h-[48px]">
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

        <Button onClick={startGame} className="w-full min-h-[48px]">
          {language === 'ar' ? 'ابدأ اللعبة' : 'Start Game'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Game Header with AI Remarks and Victory Badge */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <h3 className="text-lg font-bold">
            {language === 'ar' ? 'إكس أو' : 'Tic-Tac-Toe'}
          </h3>
          {showVictoryBadge && winner && (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full text-lg font-bold animate-bounce shadow-lg">
              {winner === playerSymbol ? '🏆 Victory!' : winner === 'draw' ? '🤝 Draw!' : '🤖 AI Wins!'}
            </div>
          )}
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
          {language === 'ar' ? `الصعوبة: ${difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'}` : `Difficulty: ${difficulty}`}
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
            {language === 'ar' ? 'العب مرة أخرى' : 'Play Again'}
          </Button>
        </div>
      )}

      {!gameOver && (
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isAIThinking 
              ? (language === 'ar' ? 'الذكاء الاصطناعي يفكر...' : 'AI thinking...')
              : isPlayerTurn 
              ? (language === 'ar' ? 'دورك - اضغط على المربع' : 'Your turn - Tap a square')
              : (language === 'ar' ? 'دور الذكاء الاصطناعي...' : 'AI turn...')
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
          {language === 'ar' ? 'إعادة تشغيل' : 'Restart'}
        </Button>
        <Button variant="outline" onClick={onBack} className="flex-1 min-h-[48px]">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    </div>
  );
}
