import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface Pawn {
  id: string;
  player: string;
  position: number;
  isHome: boolean;
  isFinished: boolean;
}

interface GameState {
  currentPlayer: 'blue' | 'red' | 'green' | 'yellow';
  diceValue: number;
  canRoll: boolean;
  gamePhase: 'setup' | 'playing' | 'finished';
  winner: string | null;
  lastMove: string;
  playerPositions: {
    blue: number[];
    red: number[];
    green: number[];
    yellow: number[];
  };
  outerPosition: {
    blue: number[];
    red: number[];
    green: number[];
    yellow: number[];
  };
}

interface LudoBoardV2Props {
  gameMode: 'single' | 'multiplayer';
  onGameEnd?: (winner: string) => void;
  className?: string;
  gameState?: GameState;
  highlightedPawns?: Set<string>;
  onPawnClick?: (pawn: Pawn) => void;
  currentPlayer?: string;
  diceValue?: number;
  onDiceRoll?: () => void;
  isRolling?: boolean;
  canRoll?: boolean;
  isAIThinking?: boolean;
}

const DiceIcon = ({ value }: { value: number }) => {
  const icons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Icon = icons[value - 1] || Dice1;
  return <Icon className="w-8 h-8" />;
};

export function LudoBoardV2({ 
  gameMode, 
  onGameEnd, 
  className,
  gameState: externalGameState,
  highlightedPawns = new Set(),
  onPawnClick,
  currentPlayer: externalCurrentPlayer,
  diceValue: externalDiceValue,
  onDiceRoll,
  isRolling = false,
  canRoll: externalCanRoll,
  isAIThinking = false
}: LudoBoardV2Props) {
  const { language } = useTheme();
  
  const [internalGameState, setInternalGameState] = useState<GameState>({
    currentPlayer: 'blue',
    diceValue: 1,
    canRoll: true,
    gamePhase: 'setup',
    winner: null,
    lastMove: '',
    playerPositions: {
      blue: [0, 0, 0, 0],
      red: [0, 0, 0, 0],
      green: [0, 0, 0, 0],
      yellow: [0, 0, 0, 0]
    },
    outerPosition: {
      blue: [1, 2, 0, 0],
      red: [0, 0, 0, 0],
      green: [0, 0, 0, 0],
      yellow: [0, 0, 0, 0]
    }
  });

  // Use external state if provided, otherwise use internal state
  const gameState = externalGameState || internalGameState;
  const currentPlayer = externalCurrentPlayer || gameState.currentPlayer;
  const diceValue = externalDiceValue || gameState.diceValue;
  const canRoll = externalCanRoll !== undefined ? externalCanRoll : gameState.canRoll;

  const [boardSquares, setBoardSquares] = useState<Array<{ color: string; pawns: string[] }>>([]);

  // Initialize board squares
  useEffect(() => {
    const squares = Array(52).fill(null).map((_, index) => ({
      color: getSquareColor(index),
      pawns: [] as string[]
    }));
    
    // Place initial pawns on the board
    if (gameState.outerPosition.blue[0] > 0) {
      squares[0].pawns.push('blue');
    }
    if (gameState.outerPosition.blue[1] > 0) {
      squares[1].pawns.push('blue');
    }
    
    setBoardSquares(squares);
  }, [gameState.outerPosition]);

  const getSquareColor = (index: number): string => {
    // Starting positions for each color
    if (index === 0) return 'blue';
    if (index === 13) return 'red';
    if (index === 26) return 'green';
    if (index === 39) return 'yellow';
    
    // Safe zones
    if ([8, 21, 34, 47].includes(index)) return 'safe';
    
    return 'normal';
  };

  const rollDice = () => {
    if (onDiceRoll) {
      onDiceRoll();
      return;
    }

    if (!canRoll) return;
    
    const newDiceValue = Math.floor(Math.random() * 6) + 1;
    console.log('🎲 Dice rolled:', newDiceValue);
    
    setInternalGameState(prev => ({
      ...prev,
      diceValue: newDiceValue,
      canRoll: false,
      lastMove: `${prev.currentPlayer} rolled ${newDiceValue}`
    }));

    if (internalGameState.gamePhase === 'setup') {
      setInternalGameState(prev => ({
        ...prev,
        gamePhase: 'playing'
      }));
    }

    if (gameMode === 'single' && internalGameState.currentPlayer !== 'blue') {
      handleAITurn(newDiceValue);
    }
  };

  const handleAITurn = (diceValue: number) => {
    const setAiThinking = (value: boolean) => {};
    setAiThinking(true);
    
    setTimeout(() => {
      // Simple AI logic - move first available pawn
      const currentColor = gameState.currentPlayer;
      const positions = gameState.playerPositions[currentColor];
      
      let moveIndex = -1;
      for (let i = 0; i < positions.length; i++) {
        if (positions[i] > 0 && positions[i] + diceValue <= 52) {
          moveIndex = i;
          break;
        }
      }

      if (moveIndex >= 0) {
        const newPositions = [...positions];
        newPositions[moveIndex] += diceValue;
        
        setInternalGameState(prev => ({
          ...prev,
          playerPositions: {
            ...prev.playerPositions,
            [currentColor]: newPositions
          },
          lastMove: `${currentColor} moved pawn ${moveIndex + 1} to position ${newPositions[moveIndex]}`
        }));
      }

      // Switch to next player
      nextPlayer();
      setAiThinking(false);
    }, 1000);
  };

  const nextPlayer = () => {
    const players = ['blue', 'red', 'green', 'yellow'];
    const currentIndex = players.indexOf(gameState.currentPlayer);
    const nextIndex = (currentIndex + 1) % players.length;
    
    setInternalGameState(prev => ({
      ...prev,
      currentPlayer: players[nextIndex] as 'blue' | 'red' | 'green' | 'yellow',
      canRoll: true
    }));
  };

  const resetGame = () => {
    setInternalGameState({
      currentPlayer: 'blue',
      diceValue: 1,
      canRoll: true,
      gamePhase: 'setup',
      winner: null,
      lastMove: '',
      playerPositions: {
        blue: [0, 0, 0, 0],
        red: [0, 0, 0, 0],
        green: [0, 0, 0, 0],
        yellow: [0, 0, 0, 0]
      },
      outerPosition: {
        blue: [1, 2, 0, 0],
        red: [0, 0, 0, 0],
        green: [0, 0, 0, 0],
        yellow: [0, 0, 0, 0]
      }
    });
  };

  const handlePawnClick = (pawn: Pawn) => {
    if (onPawnClick) {
      onPawnClick(pawn);
    }
  };

  const renderPawn = (color: string, position: number) => {
    const colorClasses = {
      blue: 'bg-blue-500 border-blue-700',
      red: 'bg-red-500 border-red-700',
      green: 'bg-green-500 border-green-700',
      yellow: 'bg-yellow-500 border-yellow-700'
    };

    return (
      <div
        key={`${color}-${position}`}
        className={`w-4 h-4 rounded-full border-2 ${colorClasses[color as keyof typeof colorClasses]} shadow-sm`}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10
        }}
      />
    );
  };

  const renderBoard = () => {
    return (
      <div className="relative w-full max-w-lg mx-auto aspect-square bg-white border-2 border-gray-300 rounded-lg">
        {/* Outer track */}
        <div className="absolute inset-4">
          {boardSquares.map((square, index) => {
            const angle = (index * 360) / 52;
            const radius = 180;
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;
            
            return (
              <div
                key={index}
                className={`absolute w-8 h-8 border border-gray-400 ${
                  square.color === 'safe' ? 'bg-green-100' : 'bg-gray-50'
                } ${square.color === 'blue' ? 'bg-blue-100' : ''}
                ${square.color === 'red' ? 'bg-red-100' : ''}
                ${square.color === 'green' ? 'bg-green-100' : ''}
                ${square.color === 'yellow' ? 'bg-yellow-100' : ''}`}
                style={{
                  left: `calc(50% + ${x}px - 16px)`,
                  top: `calc(50% + ${y}px - 16px)`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {/* Render pawns on this square */}
                {square.pawns.map((pawnColor, pawnIndex) => 
                  renderPawn(pawnColor, pawnIndex)
                )}
              </div>
            );
          })}
        </div>

        {/* Player home areas */}
        <div className="absolute top-4 left-4 w-24 h-24 bg-blue-200 border-2 border-blue-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-blue-800">Blue Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {gameState.playerPositions.blue.map((pos, index) => (
              <div key={index} className="w-4 h-4 bg-blue-100 border border-blue-300 rounded-full">
                {pos === 0 && renderPawn('blue', index)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-4 right-4 w-24 h-24 bg-red-200 border-2 border-red-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-red-800">Red Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {gameState.playerPositions.red.map((pos, index) => (
              <div key={index} className="w-4 h-4 bg-red-100 border border-red-300 rounded-full">
                {pos === 0 && renderPawn('red', index)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 w-24 h-24 bg-green-200 border-2 border-green-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-green-800">Green Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {gameState.playerPositions.green.map((pos, index) => (
              <div key={index} className="w-4 h-4 bg-green-100 border border-green-300 rounded-full">
                {pos === 0 && renderPawn('green', index)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 w-24 h-24 bg-yellow-200 border-2 border-yellow-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-yellow-800">Yellow Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {gameState.playerPositions.yellow.map((pos, index) => (
              <div key={index} className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded-full">
                {pos === 0 && renderPawn('yellow', index)}
              </div>
            ))}
          </div>
        </div>

        {/* Center area */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gray-100 border-2 border-gray-400 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold">LUDO</div>
            <div className="text-sm text-gray-600">
              {gameState.gamePhase === 'setup' ? 'Roll to Start' : `${gameState.currentPlayer}'s Turn`}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`p-6 space-y-6 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-3 py-1">
            {currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} Player
          </Badge>
          {isAIThinking && (
            <Badge variant="secondary" className="px-3 py-1">
              AI Thinking...
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={resetGame}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset Game
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-center">Ludo Board</CardTitle>
        </CardHeader>
        <CardContent>
          {renderBoard()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-4">
        <Button
          onClick={rollDice}
          disabled={!canRoll || isRolling || isAIThinking}
          className="flex items-center gap-2"
        >
          <DiceIcon value={diceValue} />
          {isRolling ? 'Rolling...' : canRoll ? 'Roll Dice' : 'Make Move'}
        </Button>
      </div>

      {gameState.lastMove && (
        <div className="text-center text-sm text-muted-foreground bg-muted p-2 rounded">
          {gameState.lastMove}
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground">
        Debug: Blue pawns on board - Position 1: {gameState.outerPosition.blue[0]}, Position 2: {gameState.outerPosition.blue[1]}
      </div>
    </div>
  );
}
