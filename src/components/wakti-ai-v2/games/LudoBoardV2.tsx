
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';
type GameArea = 'private' | 'outer' | 'last-line' | 'home';

interface Pawn {
  id: number;
  name: string;
  color: PlayerColor;
  startCell: string;
  endCell: string;
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
  gameState: GameState;
  highlightedPawns: Set<string>;
  onPawnClick: (pawn: Pawn) => void;
  currentPlayer: PlayerColor;
  diceValue: number;
  onDiceRoll: () => void;
  isRolling: boolean;
  canRoll: boolean;
}

const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];

export function LudoBoardV2({
  gameState,
  highlightedPawns,
  onPawnClick,
  currentPlayer,
  diceValue,
  onDiceRoll,
  isRolling,
  canRoll
}: LudoBoardV2Props) {
  const DiceIcon = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6][diceValue - 1];

  const renderPawn = (pawn: Pawn, isHighlighted: boolean = false) => (
    <div
      key={pawn.name}
      className={cn(
        "w-3 h-3 rounded-full border cursor-pointer transition-all duration-200",
        pawn.color === 'blue' && "bg-blue-500 border-blue-700",
        pawn.color === 'red' && "bg-red-500 border-red-700",
        pawn.color === 'green' && "bg-green-500 border-green-700",
        pawn.color === 'yellow' && "bg-yellow-500 border-yellow-700",
        isHighlighted && "scale-125 shadow-lg ring-2 ring-white",
        "hover:scale-110"
      )}
      onClick={() => onPawnClick(pawn)}
      title={`${pawn.color} pawn ${pawn.id}`}
    />
  );

  const renderCell = (position: number, isStart: boolean = false, isSafe: boolean = false) => {
    const pawns = gameState.outerPosition[position] || [];
    
    return (
      <div
        className={cn(
          "w-6 h-6 border border-gray-400 flex items-center justify-center relative text-xs",
          isSafe && "bg-yellow-100",
          isStart && "bg-green-200"
        )}
      >
        {pawns.length > 0 && (
          <div className="flex flex-wrap gap-0.5 items-center justify-center">
            {pawns.map(pawn => renderPawn(pawn, highlightedPawns.has(pawn.name)))}
          </div>
        )}
        <span className="absolute -bottom-2 -right-1 text-[8px] text-gray-400">{position}</span>
      </div>
    );
  };

  const renderPrivateArea = (color: PlayerColor) => {
    const pawns = gameState.privateAreas[color] || [];
    return (
      <div className={cn(
        "w-20 h-20 border-2 rounded grid grid-cols-2 gap-1 p-1",
        color === 'blue' && "bg-blue-100 border-blue-400",
        color === 'red' && "bg-red-100 border-red-400",
        color === 'green' && "bg-green-100 border-green-400",
        color === 'yellow' && "bg-yellow-100 border-yellow-400"
      )}>
        {[0, 1, 2, 3].map(index => (
          <div key={index} className="w-8 h-8 border border-gray-300 rounded flex items-center justify-center">
            {pawns[index] && renderPawn(pawns[index], highlightedPawns.has(pawns[index].name))}
          </div>
        ))}
      </div>
    );
  };

  const renderHomeTriangle = (color: PlayerColor) => {
    const pawns = gameState.homeAreas[color] || [];
    const triangleStyle = {
      clipPath: color === 'red' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' :
               color === 'blue' ? 'polygon(0% 0%, 100% 50%, 0% 100%)' :
               color === 'yellow' ? 'polygon(0% 0%, 100% 0%, 50% 100%)' :
               'polygon(100% 0%, 0% 50%, 100% 100%)'
    };

    return (
      <div 
        className={cn(
          "w-16 h-16 flex items-center justify-center",
          color === 'blue' && "bg-blue-300",
          color === 'red' && "bg-red-300",
          color === 'green' && "bg-green-300",
          color === 'yellow' && "bg-yellow-300"
        )}
        style={triangleStyle}
      >
        {pawns.length > 0 && (
          <div className="flex flex-wrap gap-0.5 items-center justify-center">
            {pawns.slice(0, 4).map(pawn => renderPawn(pawn, highlightedPawns.has(pawn.name)))}
          </div>
        )}
      </div>
    );
  };

  const renderLastLine = (color: PlayerColor) => {
    const cells = [];
    for (let i = 1; i <= 5; i++) {
      const pawns = gameState.lastLine[color]?.[i] || [];
      cells.push(
        <div key={i} className={cn(
          "w-6 h-6 border border-gray-400 flex items-center justify-center",
          color === 'blue' && "bg-blue-50",
          color === 'red' && "bg-red-50",
          color === 'green' && "bg-green-50",
          color === 'yellow' && "bg-yellow-50"
        )}>
          {pawns.map(pawn => renderPawn(pawn, highlightedPawns.has(pawn.name)))}
        </div>
      );
    }
    return cells;
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4 max-w-md mx-auto">
      {/* Current Player Indicator */}
      <div className="text-center mb-2">
        <div className={cn(
          "px-3 py-1 rounded text-white text-sm font-bold",
          currentPlayer === 'blue' && "bg-blue-500",
          currentPlayer === 'red' && "bg-red-500",
          currentPlayer === 'green' && "bg-green-500",
          currentPlayer === 'yellow' && "bg-yellow-500"
        )}>
          {currentPlayer.toUpperCase()}'s Turn
        </div>
      </div>

      {/* Game Board - 3 sections layout */}
      <div className="flex flex-col items-center gap-0">
        
        {/* Top Section */}
        <div className="flex items-center gap-0">
          {/* Red Private Area */}
          <div className="flex flex-col items-center">
            {renderPrivateArea('red')}
          </div>
          
          {/* Top Track */}
          <div className="flex flex-col gap-0">
            <div className="flex gap-0">
              {[52, 51, 50, 49, 48, 47].map(pos => renderCell(pos, pos === 48, SAFE_POSITIONS.includes(pos)))}
            </div>
            <div className="flex gap-0">
              {renderLastLine('red')}
            </div>
          </div>
          
          {/* Blue Private Area */}
          <div className="flex flex-col items-center">
            {renderPrivateArea('blue')}
          </div>
        </div>

        {/* Middle Section */}
        <div className="flex items-center gap-0">
          {/* Left Track */}
          <div className="flex flex-col gap-0">
            {[1, 2, 3, 4, 5, 6].map(pos => renderCell(pos, pos === 1, SAFE_POSITIONS.includes(pos)))}
          </div>
          
          {/* Red Last Line */}
          <div className="flex flex-col gap-0">
            {renderLastLine('red').reverse()}
          </div>
          
          {/* Center Home Area */}
          <div className="w-16 h-16 relative bg-gray-100 border border-gray-400">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
              {renderHomeTriangle('red')}
            </div>
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              {renderHomeTriangle('blue')}
            </div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
              {renderHomeTriangle('yellow')}
            </div>
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
              {renderHomeTriangle('green')}
            </div>
          </div>
          
          {/* Blue Last Line */}
          <div className="flex flex-col gap-0">
            {renderLastLine('blue')}
          </div>
          
          {/* Right Track */}
          <div className="flex flex-col gap-0">
            {[13, 14, 15, 16, 17, 18].map(pos => renderCell(pos, pos === 14, SAFE_POSITIONS.includes(pos)))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex items-center gap-0">
          {/* Green Private Area */}
          <div className="flex flex-col items-center">
            {renderPrivateArea('green')}
          </div>
          
          {/* Bottom Track */}
          <div className="flex flex-col gap-0">
            <div className="flex gap-0">
              {renderLastLine('green')}
            </div>
            <div className="flex gap-0">
              {[19, 20, 21, 22, 23, 24].map(pos => renderCell(pos, pos === 27, SAFE_POSITIONS.includes(pos)))}
            </div>
          </div>
          
          {/* Yellow Private Area */}
          <div className="flex flex-col items-center">
            {renderPrivateArea('yellow')}
          </div>
        </div>
      </div>

      {/* Dice Section */}
      <div className="flex items-center space-x-4 mt-4">
        <Button
          onClick={onDiceRoll}
          disabled={!canRoll || isRolling}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 text-sm font-bold",
            currentPlayer === 'blue' && "bg-blue-500 hover:bg-blue-600",
            currentPlayer === 'red' && "bg-red-500 hover:bg-red-600",
            currentPlayer === 'green' && "bg-green-500 hover:bg-green-600",
            currentPlayer === 'yellow' && "bg-yellow-500 hover:bg-yellow-600",
            isRolling && "animate-pulse"
          )}
        >
          <DiceIcon className="w-5 h-5" />
          <span>{isRolling ? 'Rolling...' : `Roll (${diceValue})`}</span>
        </Button>
      </div>
    </div>
  );
}
