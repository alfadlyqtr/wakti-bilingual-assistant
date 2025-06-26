import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { Chess } from 'chess.js';

interface ChessGameProps {
  onBack: () => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';
type PlayerColor = 'white' | 'black';

const AI_REMARKS = {
  easy: [
    "Oops, is that check?",
    "Go easy on me...",
    "Hmm, I forgot how the horse moves."
  ],
  medium: [
    "Good move. Let me think…",
    "I won't fall for that again.",
    "Tricky. I like it."
  ],
  hard: [
    "This ends in 8 moves. You just don't know it yet.",
    "Nice try, human.",
    "I am the AI. Resistance is futile."
  ]
};

const PIECE_SYMBOLS = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

export function ChessGame({ onBack }: ChessGameProps) {
  const { language } = useTheme();
  const { showSuccess, showInfo, showError } = useToastHelper();
  
  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [playerColor, setPlayerColor] = useState<PlayerColor>('white');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  // Load saved game state
  useEffect(() => {
    const savedGame = localStorage.getItem('wakti_chess_game');
    if (savedGame) {
      const gameState = JSON.parse(savedGame);
      const loadedGame = new Chess();
      try {
        loadedGame.load(gameState.fen);
        setGame(loadedGame);
        setGamePosition(gameState.fen);
        setPlayerColor(gameState.playerColor);
        setDifficulty(gameState.difficulty);
        setGameStarted(gameState.gameStarted);
        setGameOver(gameState.gameOver);
        setIsPlayerTurn(gameState.isPlayerTurn);
      } catch (error) {
        console.error('Failed to load saved chess game:', error);
      }
    }
  }, []);

  // Save game state
  useEffect(() => {
    if (gameStarted) {
      const gameState = {
        fen: game.fen(),
        playerColor,
        difficulty,
        gameStarted,
        gameOver,
        isPlayerTurn
      };
      localStorage.setItem('wakti_chess_game', JSON.stringify(gameState));
    }
  }, [game, playerColor, difficulty, gameStarted, gameOver, isPlayerTurn]);

  const evaluatePosition = (game: Chess): number => {
    let score = 0;
    const board = game.board();
    
    const pieceValues: { [key: string]: number } = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
      'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0
    };

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          const value = pieceValues[piece.type];
          if (piece.color === 'w') {
            score += value;
          } else {
            score -= value;
          }
        }
      }
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
        return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      
      case 'medium':
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
        const minimax = (game: Chess, depth: number, isMaximizing: boolean): number => {
          if (depth === 0 || game.isGameOver()) {
            return evaluatePosition(game);
          }
          
          const moves = game.moves();
          if (isMaximizing) {
            let maxEvaluation = -Infinity;
            for (const move of moves) {
              const gameCopy = new Chess(game.fen());
              gameCopy.move(move);
              const evaluation = minimax(gameCopy, depth - 1, false);
              maxEvaluation = Math.max(maxEvaluation, evaluation);
            }
            return maxEvaluation;
          } else {
            let minEvaluation = Infinity;
            for (const move of moves) {
              const gameCopy = new Chess(game.fen());
              gameCopy.move(move);
              const evaluation = minimax(gameCopy, depth - 1, true);
              minEvaluation = Math.min(minEvaluation, evaluation);
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
            bestHardMove = move;
          }
        }
        
        return bestHardMove;
      
      default:
        return possibleMoves[0];
    }
  };

  const makeAIMove = useCallback(() => {
    if (gameOver || isPlayerTurn) return;
    
    setTimeout(() => {
      const aiMove = getAIMove(game);
      if (aiMove) {
        const gameCopy = new Chess(game.fen());
        try {
          gameCopy.move(aiMove);
          setGame(gameCopy);
          setGamePosition(gameCopy.fen());
          
          if (gameCopy.isGameOver()) {
            setGameOver(true);
            if (gameCopy.isCheckmate()) {
              showSuccess(language === 'ar' ? 'فاز الذكاء الاصطناعي بالكش مات!' : 'AI won by checkmate!');
            } else if (gameCopy.isDraw()) {
              showInfo(language === 'ar' ? 'تعادل!' : 'Game is a draw!');
            }
          } else {
            setIsPlayerTurn(true);
            
            if (Math.random() < 0.3) {
              const remarks = AI_REMARKS[difficulty];
              const randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
              showInfo(`AI: ${randomRemark}`);
            }
          }
        } catch (error) {
          console.error('Invalid AI move:', error);
        }
      }
    }, 1000);
  }, [game, gameOver, isPlayerTurn, difficulty, language, showSuccess, showInfo]);

  useEffect(() => {
    if (gameStarted && !isPlayerTurn && !gameOver) {
      makeAIMove();
    }
  }, [gameStarted, isPlayerTurn, gameOver, makeAIMove]);

  const getSquarePosition = (index: number) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const files = 'abcdefgh';
    const ranks = '87654321';
    return files[col] + ranks[row];
  };

  const handleSquareClick = (square: string) => {
    if (!gameStarted || !isPlayerTurn || gameOver) return;

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    if (selectedSquare && possibleMoves.includes(square)) {
      // Make move
      const gameCopy = new Chess(game.fen());
      try {
        const move = gameCopy.move({
          from: selectedSquare,
          to: square,
          promotion: 'q'
        });
        
        if (move) {
          setGame(gameCopy);
          setGamePosition(gameCopy.fen());
          setIsPlayerTurn(false);
          setSelectedSquare(null);
          setPossibleMoves([]);
          
          if (gameCopy.isGameOver()) {
            setGameOver(true);
            if (gameCopy.isCheckmate()) {
              showSuccess(language === 'ar' ? 'لقد فزت بالكش مات!' : 'You won by checkmate!');
            } else if (gameCopy.isDraw()) {
              showInfo(language === 'ar' ? 'تعادل!' : 'Game is a draw!');
            }
          }
        }
      } catch (error) {
        showError(language === 'ar' ? 'حركة غير صحيحة' : 'Invalid move');
      }
    } else {
      // Select piece
      const moves = game.moves({ square: square as any, verbose: true });
      if (moves.length > 0) {
        setSelectedSquare(square);
        setPossibleMoves(moves.map(move => move.to));
      }
    }
  };

  const renderBoard = () => {
    const board = game.board();
    const squares = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        const square = getSquarePosition(row * 8 + col);
        const isLight = (row + col) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isPossibleMove = possibleMoves.includes(square);
        
        squares.push(
          <div
            key={square}
            className={`
              w-10 h-10 flex items-center justify-center cursor-pointer text-2xl
              ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
              ${isSelected ? 'ring-4 ring-blue-500' : ''}
              ${isPossibleMove ? 'bg-green-300' : ''}
              hover:opacity-80 transition-all
            `}
            onClick={() => handleSquareClick(square)}
          >
            {piece && PIECE_SYMBOLS[piece.type.toUpperCase() as keyof typeof PIECE_SYMBOLS]}
          </div>
        );
      }
    }
    
    return (
      <div className={`grid grid-cols-8 gap-0 border-2 border-amber-900 ${playerColor === 'black' ? 'rotate-180' : ''}`}>
        {squares}
      </div>
    );
  };

  const startGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGamePosition(newGame.fen());
    setGameStarted(true);
    setGameOver(false);
    setIsPlayerTurn(playerColor === 'white');
    setSelectedSquare(null);
    setPossibleMoves([]);
    
    if (playerColor === 'black') {
      setTimeout(() => {
        const aiMove = getAIMove(newGame);
        if (aiMove) {
          newGame.move(aiMove);
          setGame(newGame);
          setGamePosition(newGame.fen());
          setIsPlayerTurn(true);
        }
      }, 1000);
    }
  };

  const restartGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGamePosition(newGame.fen());
    setGameStarted(false);
    setGameOver(false);
    setIsPlayerTurn(true);
    setSelectedSquare(null);
    setPossibleMoves([]);
    localStorage.removeItem('wakti_chess_game');
  };

  if (!gameStarted) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ar' ? 'اختر لونك:' : 'Choose your color:'}
            </label>
            <div className="flex gap-2">
              <Button
                variant={playerColor === 'white' ? 'default' : 'outline'}
                onClick={() => setPlayerColor('white')}
                className="flex-1"
              >
                {language === 'ar' ? '⚪ أبيض' : '⚪ White'}
              </Button>
              <Button
                variant={playerColor === 'black' ? 'default' : 'outline'}
                onClick={() => setPlayerColor('black')}
                className="flex-1"
              >
                {language === 'ar' ? '⚫ أسود' : '⚫ Black'}
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
          {language === 'ar' ? `أنت: ${playerColor === 'white' ? 'أبيض' : 'أسود'}` : `You: ${playerColor}`} | 
          {language === 'ar' ? ` الذكاء الاصطناعي: ${playerColor === 'white' ? 'أسود' : 'أبيض'}` : ` AI: ${playerColor === 'white' ? 'black' : 'white'}`}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {language === 'ar' ? `الصعوبة: ${difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'}` : `Difficulty: ${difficulty}`}
        </p>
      </div>

      <div className="flex justify-center">
        <div className="w-fit">
          {renderBoard()}
        </div>
      </div>

      {!gameOver && (
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isPlayerTurn 
              ? (language === 'ar' ? 'دورك - اضغط على القطعة ثم على المربع المطلوب' : 'Your turn - Click piece then target square')
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
