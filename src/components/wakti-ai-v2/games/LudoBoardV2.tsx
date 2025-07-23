
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCcw } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';
type PlayerType = 'human' | 'ai';
type GameArea = 'private' | 'outer' | 'last-line' | 'home';

interface Pawn {
  id: number;
  name: string;
  color: PlayerColor;
  startCell: number;
  endCell: number;
  currentCell: string;
  area: GameArea;
}

interface GameState {
  privateAreas: Record<PlayerColor, Pawn[]>;
  outerPosition: Record<number, Pawn[]>;
  lastLine: Record<PlayerColor, Record<number, Pawn[]>>;
  homeAreas: Record<PlayerColor, Pawn[]>;
}

interface LudoBoardV2Props {
  gameMode?: 'single' | 'multiplayer';
  onGameEnd?: (winner: string) => void;
  className?: string;
  gameState?: GameState;
  highlightedPawns?: Set<string>;
  onPawnClick?: (pawn: Pawn) => void;
  currentPlayer?: PlayerColor;
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
  gameMode = 'single', 
  onGameEnd, 
  className,
  gameState,
  highlightedPawns = new Set(),
  onPawnClick,
  currentPlayer = 'blue',
  diceValue = 1,
  onDiceRoll,
  isRolling = false,
  canRoll = true,
  isAIThinking = false
}: LudoBoardV2Props) {
  const { language } = useTheme();
  
  // Default game state for standalone usage
  const defaultGameState: GameState = {
    privateAreas: { blue: [], red: [], green: [], yellow: [] },
    outerPosition: {},
    lastLine: { blue: {}, red: {}, green: {}, yellow: {} },
    homeAreas: { blue: [], red: [], green: [], yellow: [] }
  };

  const [internalGameState, setInternalGameState] = useState<GameState>(defaultGameState);
  const [boardSquares, setBoardSquares] = useState<Array<{ color: string; pawns: Pawn[] }>>([]);

  // Use external state if provided, otherwise use internal state
  const currentGameState = gameState || internalGameState;

  // Initialize board squares
  useEffect(() => {
    const squares = Array(52).fill(null).map((_, index) => ({
      color: getSquareColor(index),
      pawns: [] as Pawn[]
    }));
    
    // Place pawns from outer positions
    Object.entries(currentGameState.outerPosition).forEach(([position, pawns]) => {
      const pos = parseInt(position);
      if (pos >= 1 && pos <= 52) {
        squares[pos - 1].pawns = pawns;
      }
    });
    
    setBoardSquares(squares);
  }, [currentGameState.outerPosition]);

  const getSquareColor = (index: number): string => {
    const position = index + 1;
    
    // Starting positions for each color
    if (position === 1) return 'blue';
    if (position === 14) return 'red';
    if (position === 27) return 'green';
    if (position === 40) return 'yellow';
    
    // Safe zones
    if ([9, 22, 35, 48].includes(position)) return 'safe';
    
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
    
    // Update internal state if not using external state
    if (!gameState) {
      setInternalGameState(prev => ({
        ...prev,
        // Add any internal state updates here if needed
      }));
    }
  };

  const handlePawnClick = (pawn: Pawn) => {
    if (onPawnClick) {
      onPawnClick(pawn);
    }
  };

  const renderPawn = (pawn: Pawn, stackIndex: number = 0) => {
    const colorClasses = {
      blue: 'bg-blue-500 border-blue-700',
      red: 'bg-red-500 border-red-700',
      green: 'bg-green-500 border-green-700',
      yellow: 'bg-yellow-500 border-yellow-700'
    };

    const isHighlighted = highlightedPawns.has(pawn.name);
    const offset = stackIndex * 2;

    return (
      <div
        key={pawn.name}
        className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all ${
          colorClasses[pawn.color]
        } ${isHighlighted ? 'ring-2 ring-yellow-400 ring-opacity-75 animate-pulse' : ''}`}
        style={{
          position: 'absolute',
          top: `calc(50% + ${offset}px)`,
          left: `calc(50% + ${offset}px)`,
          transform: 'translate(-50%, -50%)',
          zIndex: 10 + stackIndex
        }}
        onClick={() => handlePawnClick(pawn)}
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
                {square.pawns.map((pawn, pawnIndex) => 
                  renderPawn(pawn, pawnIndex)
                )}
              </div>
            );
          })}
        </div>

        {/* Player home areas */}
        <div className="absolute top-4 left-4 w-24 h-24 bg-blue-200 border-2 border-blue-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-blue-800">Blue Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.privateAreas.blue.map((pawn, index) => (
              <div key={index} className="w-4 h-4 bg-blue-100 border border-blue-300 rounded-full relative">
                {renderPawn(pawn)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-4 right-4 w-24 h-24 bg-red-200 border-2 border-red-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-red-800">Red Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.privateAreas.red.map((pawn, index) => (
              <div key={index} className="w-4 h-4 bg-red-100 border border-red-300 rounded-full relative">
                {renderPawn(pawn)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 w-24 h-24 bg-green-200 border-2 border-green-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-green-800">Green Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.privateAreas.green.map((pawn, index) => (
              <div key={index} className="w-4 h-4 bg-green-100 border border-green-300 rounded-full relative">
                {renderPawn(pawn)}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 w-24 h-24 bg-yellow-200 border-2 border-yellow-400 rounded-lg">
          <div className="p-2 text-xs font-bold text-yellow-800">Yellow Home</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.privateAreas.yellow.map((pawn, index) => (
              <div key={index} className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded-full relative">
                {renderPawn(pawn)}
              </div>
            ))}
          </div>
        </div>

        {/* Finished pawns areas */}
        <div className="absolute top-1/2 left-1/3 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-blue-300 border border-blue-500 rounded">
          <div className="text-xs text-center p-1">Blue Finish</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.homeAreas.blue.map((pawn, index) => (
              <div key={index} className="w-2 h-2 bg-blue-600 rounded-full" />
            ))}
          </div>
        </div>

        <div className="absolute top-1/3 right-1/2 transform translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-red-300 border border-red-500 rounded">
          <div className="text-xs text-center p-1">Red Finish</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.homeAreas.red.map((pawn, index) => (
              <div key={index} className="w-2 h-2 bg-red-600 rounded-full" />
            ))}
          </div>
        </div>

        <div className="absolute bottom-1/2 left-1/3 transform -translate-x-1/2 translate-y-1/2 w-16 h-16 bg-green-300 border border-green-500 rounded">
          <div className="text-xs text-center p-1">Green Finish</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.homeAreas.green.map((pawn, index) => (
              <div key={index} className="w-2 h-2 bg-green-600 rounded-full" />
            ))}
          </div>
        </div>

        <div className="absolute bottom-1/3 right-1/2 transform translate-x-1/2 translate-y-1/2 w-16 h-16 bg-yellow-300 border border-yellow-500 rounded">
          <div className="text-xs text-center p-1">Yellow Finish</div>
          <div className="grid grid-cols-2 gap-1 p-1">
            {currentGameState.homeAreas.yellow.map((pawn, index) => (
              <div key={index} className="w-2 h-2 bg-yellow-600 rounded-full" />
            ))}
          </div>
        </div>

        {/* Center area */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gray-100 border-2 border-gray-400 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold">LUDO</div>
            <div className="text-sm text-gray-600">
              {currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s Turn
            </div>
          </div>
        </div>
      </div>
    );
  };

  const resetGame = () => {
    setInternalGameState(defaultGameState);
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

      <div className="text-center text-xs text-muted-foreground">
        Debug: Pawns in private areas - Blue: {currentGameState.privateAreas.blue.length}, Red: {currentGameState.privateAreas.red.length}, Green: {currentGameState.privateAreas.green.length}, Yellow: {currentGameState.privateAreas.yellow.length}
      </div>
    </div>
  );
}
