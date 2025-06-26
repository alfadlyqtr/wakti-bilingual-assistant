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
    "Wait, which way does the knight move again?",
    "Oops, did I just give away my queen?",
    "Chess is harder than I thought...",
    "Is that checkmate? Already?!",
    "I'll get better... eventually."
  ],
  medium: [
    "Interesting strategy you have there.",
    "I see what you're trying to do...",
    "This position looks promising for me.",
    "You're making me work for this win.",
    "Let me think about this move..."
  ],
  hard: [
    "You cannot escape the inevitable.",
    "I have calculated 47 moves ahead.",
    "Your position is already lost.",
    "Impressive... but futile.",
    "Even grandmasters fear my algorithm."
  ]
};

const VICTORY_REMARKS = {
  player_win: [
    "Impossible! A human defeated me?! 🏆",
    "Well played, chess master! 👑",
    "You have earned my respect! 🎉",
    "Victory is yours... this time! ⭐",
    "I shall study this game forever! 🤯"
  ],
  ai_win: [
    "As calculated. Victory achieved! 🤖",
    "Another human falls to my logic! 😎",
    "Chess mastery belongs to AI! 🏆"
  ],
  draw: [
    "A stalemate... you fought well! 🤝",
    "Neither king shall fall today!",
    "Honor in battle, honor in draw! ⚖️"
  ]
};

// Enhanced chess pieces with better contrast
const PIECE_SYMBOLS = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Piece values for evaluation
const PIECE_VALUES = {
  'p': 100, 'n': 300, 'b': 300, 'r': 500, 'q': 900, 'k': 10000
};

// Position evaluation tables
const PIECE_SQUARE_TABLES = {
  'p': [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
  ],
  'n': [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ]
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
  const [currentAIRemark, setCurrentAIRemark] = useState<string>('');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [showVictoryBadge, setShowVictoryBadge] = useState(false);

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
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const pieceValue = PIECE_VALUES[piece.type];
          let positionValue = 0;
          
          // Add position bonus for pawns and knights
          if (piece.type === 'p' && PIECE_SQUARE_TABLES.p) {
            const index = piece.color === 'w' ? row * 8 + col : (7 - row) * 8 + col;
            positionValue = PIECE_SQUARE_TABLES.p[index];
          } else if (piece.type === 'n' && PIECE_SQUARE_TABLES.n) {
            const index = row * 8 + col;
            positionValue = PIECE_SQUARE_TABLES.n[index];
          }
          
          const totalValue = pieceValue + positionValue;
          
          if (piece.color === 'w') {
            score += totalValue;
          } else {
            score -= totalValue;
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
        // 40% chance to make a good move, 60% random
        if (Math.random() < 0.4) {
          // Look for checkmate in 1
          for (const move of possibleMoves) {
            const gameCopy = new Chess(currentGame.fen());
            gameCopy.move(move);
            if (gameCopy.isCheckmate()) {
              return move;
            }
          }
          
          // Avoid blunders (don't hang pieces)
          const safeMoves = possibleMoves.filter(move => {
            const gameCopy = new Chess(currentGame.fen());
            gameCopy.move(move);
            const evaluation = evaluatePosition(gameCopy);
            const currentEval = evaluatePosition(currentGame);
            return Math.abs(evaluation - currentEval) < 300; // Don't lose major pieces
          });
          
          if (safeMoves.length > 0) {
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
          }
        }
        return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      
      case 'medium':
        // Look deeper with better evaluation
        let bestMove = possibleMoves[0];
        let bestScore = isAIWhite ? -Infinity : Infinity;
        
        for (const move of possibleMoves) {
          const gameCopy = new Chess(currentGame.fen());
          gameCopy.move(move);
          
          // Look 1-2 moves ahead
          let score = evaluatePosition(gameCopy);
          
          // Simple 1-ply lookahead
          const nextMoves = gameCopy.moves();
          if (nextMoves.length > 0) {
            let nextBest = isAIWhite ? Infinity : -Infinity;
            for (let i = 0; i < Math.min(5, nextMoves.length); i++) {
              const nextGame = new Chess(gameCopy.fen());
              nextGame.move(nextMoves[i]);
              const nextScore = evaluatePosition(nextGame);
              if (isAIWhite) {
                nextBest = Math.min(nextBest, nextScore);
              } else {
                nextBest = Math.max(nextBest, nextScore);
              }
            }
            score = (score + nextBest) / 2;
          }
          
          if (isAIWhite ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = move;
          }
        }
        
        return bestMove;
      
      case 'hard':
        // Advanced minimax with alpha-beta pruning
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
              if (beta <= alpha) break; // Alpha-beta pruning
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
              if (beta <= alpha) break; // Alpha-beta pruning
            }
            return minEvaluation;
          }
        };
        
        let bestHardMove = possibleMoves[0];
        let bestHardScore = isAIWhite ? -Infinity : Infinity;
        
        for (const move of possibleMoves) {
          const gameCopy = new Chess(currentGame.fen());
          gameCopy.move(move);
          const score = minimax(gameCopy, 3, !isAIWhite); // 3-ply search
          
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

  const getAIThinkingTime = (difficulty: Difficulty): number => {
    switch (difficulty) {
      case 'easy': return 1500 + Math.random() * 1000; // 1.5-2.5s
      case 'medium': return 2500 + Math.random() * 1500; // 2.5-4s
      case 'hard': return 4000 + Math.random() * 2000; // 4-6s
      default: return 3000;
    }
  };

  const showAIRemark = (type: 'game' | 'victory' = 'game') => {
    let remarks: string[];
    
    if (type === 'victory') {
      if (game.isCheckmate()) {
        if ((game.turn() === 'w' && playerColor === 'black') || (game.turn() === 'b' && playerColor === 'white')) {
          remarks = VICTORY_REMARKS.player_win;
        } else {
          remarks = VICTORY_REMARKS.ai_win;
        }
      } else {
        remarks = VICTORY_REMARKS.draw;
      }
    } else {
      remarks = AI_REMARKS[difficulty];
    }
    
    const randomRemark = remarks[Math.floor(Math.random() * remarks.length)];
    setCurrentAIRemark(randomRemark);
    
    setTimeout(() => {
      setCurrentAIRemark('');
    }, type === 'victory' ? 6000 : 4000);
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
          setGamePosition(gameCopy.fen());
          
          if (gameCopy.isGameOver()) {
            setGameOver(true);
            setShowVictoryBadge(true);
            setTimeout(() => showAIRemark('victory'), 500);
          } else {
            setIsPlayerTurn(true);
            
            // Show AI remark occasionally after moves
            if (Math.random() < 0.3) {
              setTimeout(() => showAIRemark('game'), 500);
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
            setShowVictoryBadge(true);
            setTimeout(() => showAIRemark('victory'), 500);
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
              w-12 h-12 flex items-center justify-center cursor-pointer text-3xl font-bold
              transition-all duration-200 active:scale-95 relative select-none touch-manipulation
              ${isLight 
                ? 'bg-amber-100 dark:bg-amber-200' 
                : 'bg-amber-700 dark:bg-amber-800'
              }
              ${isSelected ? 'ring-4 ring-blue-500 bg-blue-200 dark:bg-blue-600 transform scale-110' : ''}
              ${isPossibleMove ? 'bg-green-300 dark:bg-green-600 ring-2 ring-green-400' : ''}
              hover:brightness-110
            `}
            onTouchStart={() => handleSquareClick(square)}
            onClick={() => handleSquareClick(square)}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {piece && (
              <span 
                className={`
                  ${piece.color === 'w' 
                    ? 'text-white' 
                    : 'text-black'
                  }
                  ${isSelected ? 'scale-110 animate-pulse' : ''}
                  transition-all duration-200 pointer-events-none
                `}
                style={{
                  filter: piece.color === 'w' 
                    ? 'drop-shadow(2px 2px 1px #000) drop-shadow(-1px -1px 1px #000) drop-shadow(2px -1px 1px #000) drop-shadow(-1px 2px 1px #000)'
                    : 'drop-shadow(2px 2px 1px #fff) drop-shadow(-1px -1px 1px #fff) drop-shadow(2px -1px 1px #fff) drop-shadow(-1px 2px 1px #fff)',
                  textShadow: piece.color === 'w' 
                    ? '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000'
                    : '2px 2px 0px #fff, -2px -2px 0px #fff, 2px -2px 0px #fff, -2px 2px 0px #fff'
                }}
              >
                {PIECE_SYMBOLS[piece.type.toUpperCase() as keyof typeof PIECE_SYMBOLS]}
              </span>
            )}
            {isPossibleMove && !piece && (
              <div className="w-4 h-4 bg-green-500 rounded-full opacity-70 animate-pulse"></div>
            )}
            {isPossibleMove && piece && (
              <div className="absolute inset-0 border-4 border-red-400 rounded-sm animate-pulse"></div>
            )}
          </div>
        );
      }
    }
    
    return (
      <div className={`grid grid-cols-8 gap-0 border-4 border-amber-900 rounded-lg overflow-hidden ${playerColor === 'black' ? 'rotate-180' : ''}`}>
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
    setCurrentAIRemark('');
    
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
    setCurrentAIRemark('');
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
                onTouchStart={() => setPlayerColor('white')}
                onClick={() => setPlayerColor('white')}
                className="flex-1 min-h-[48px]"
              >
                {language === 'ar' ? '⚪ أبيض' : '⚪ White'}
              </Button>
              <Button
                variant={playerColor === 'black' ? 'default' : 'outline'}
                onTouchStart={() => setPlayerColor('black')}
                onClick={() => setPlayerColor('black')}
                className="flex-1 min-h-[48px]"
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
            {language === 'ar' ? 'شطرنج' : 'Chess'}
          </h3>
          {showVictoryBadge && gameOver && (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full text-lg font-bold animate-bounce shadow-lg">
              {game.isCheckmate() ? 
                ((game.turn() === 'w' && playerColor === 'black') || (game.turn() === 'b' && playerColor === 'white')) ? 
                '🏆 Checkmate! You Win!' : '🤖 AI Checkmate!' 
                : '🤝 Draw!'}
            </div>
          )}
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
          {language === 'ar' ? `الصعوبة: ${difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'}` : `Difficulty: ${difficulty}`}
        </p>
      </div>

      <div className="flex justify-center overflow-x-auto">
        <div className="min-w-fit">
          {renderBoard()}
        </div>
      </div>

      {!gameOver && (
        <div className="text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isAIThinking 
              ? (language === 'ar' ? 'الذكاء الاصطناعي يحسب...' : 'AI calculating...')
              : isPlayerTurn 
              ? (language === 'ar' ? 'دورك - اضغط على القطعة ثم على الهدف' : 'Your turn - Tap piece then destination')
              : (language === 'ar' ? 'دور الذكاء الاصطناعي...' : 'AI turn...')
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
          {language === 'ar' ? 'إعادة تشغيل' : 'Restart'}
        </Button>
        <Button variant="outline" onClick={onBack} className="flex-1 min-h-[48px]">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    </div>
  );
}
