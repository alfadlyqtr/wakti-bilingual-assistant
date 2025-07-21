
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
        "w-4 h-4 rounded-full border-2 cursor-pointer transition-all duration-200",
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

  const renderCell = (position: number, type: 'normal' | 'safe' | 'start' = 'normal') => {
    const pawns = gameState.outerPosition[position] || [];
    const isSafe = SAFE_POSITIONS.includes(position);
    const isStart = [1, 14, 27, 40].includes(position);
    
    return (
      <div
        key={position}
        className={cn(
          "w-8 h-8 border border-gray-300 flex items-center justify-center relative",
          isSafe && "bg-green-100",
          isStart && "bg-yellow-100",
          type === 'safe' && "bg-green-200",
          type === 'start' && "bg-yellow-200"
        )}
      >
        {pawns.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {pawns.map(pawn => renderPawn(pawn, highlightedPawns.has(pawn.name)))}
          </div>
        )}
        <span className="absolute bottom-0 right-0 text-xs text-gray-400">{position}</span>
      </div>
    );
  };

  const renderPrivateArea = (color: PlayerColor) => {
    const pawns = gameState.privateAreas[color] || [];
    return (
      <div className={cn(
        "w-24 h-24 border-2 rounded-lg flex flex-wrap items-center justify-center gap-1 p-2",
        color === 'blue' && "bg-blue-100 border-blue-300",
        color === 'red' && "bg-red-100 border-red-300",
        color === 'green' && "bg-green-100 border-green-300",
        color === 'yellow' && "bg-yellow-100 border-yellow-300"
      )}>
        {pawns.map(pawn => renderPawn(pawn, highlightedPawns.has(pawn.name)))}
      </div>
    );
  };

  const renderHomeTriangle = (color: PlayerColor) => {
    const pawns = gameState.homeAreas[color] || [];
    return (
      <div className={cn(
        "w-12 h-12 flex items-center justify-center relative",
        color === 'blue' && "bg-blue-200",
        color === 'red' && "bg-red-200",
        color === 'green' && "bg-green-200",
        color === 'yellow' && "bg-yellow-200"
      )}
      style={{
        clipPath: color === 'blue' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' :
                 color === 'red' ? 'polygon(0% 0%, 100% 0%, 50% 100%)' :
                 color === 'green' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' :
                 'polygon(0% 0%, 100% 0%, 50% 100%)'
      }}>
        {pawns.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {pawns.slice(0, 4).map(pawn => renderPawn(pawn, highlightedPawns.has(pawn.name)))}
          </div>
        )}
      </div>
    );
  };

  const renderLastLine = (color: PlayerColor) => {
    const cells = [];
    for (let i = 1; i <= 5; i++) {
      const pawns = gameState.lastLine[color][i] || [];
      cells.push(
        <div key={i} className={cn(
          "w-8 h-8 border border-gray-300 flex items-center justify-center",
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
    <div className="flex flex-col items-center space-y-4 p-4">
      {/* Current Player Indicator */}
      <div className="text-center">
        <div className={cn(
          "px-4 py-2 rounded-lg font-bold text-white mb-2",
          currentPlayer === 'blue' && "bg-blue-500",
          currentPlayer === 'red' && "bg-red-500",
          currentPlayer === 'green' && "bg-green-500",
          currentPlayer === 'yellow' && "bg-yellow-500"
        )}>
          {currentPlayer.toUpperCase()}'s Turn
        </div>
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-15 gap-0 border-4 border-gray-800 bg-white p-2">
        {/* Row 1 - Top */}
        <div className="col-span-6 grid grid-cols-6">
          {[7, 8, 9, 10, 11, 12].map(pos => renderCell(pos))}
        </div>
        <div className="col-span-3 grid grid-cols-3">
          <div></div>
          {renderCell(13)}
          <div></div>
        </div>
        <div className="col-span-6 grid grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(pos => renderCell(pos))}
        </div>

        {/* Row 2 - Red private area and path */}
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-2">{renderPrivateArea('red')}</div>
          <div className="col-span-4 grid grid-cols-4">
            {renderLastLine('red')}
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3">
          {renderCell(52)}
          <div className="bg-gray-100"></div>
          {renderCell(14)}
        </div>
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-4 grid grid-cols-4">
            {renderLastLine('blue').reverse()}
          </div>
          <div className="col-span-2">{renderPrivateArea('blue')}</div>
        </div>

        {/* Row 3 - Vertical paths */}
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-2"></div>
          <div className="col-span-4 grid grid-cols-4">
            {[51, 50, 49, 48].map(pos => renderCell(pos))}
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3">
          {renderCell(51)}
          <div className="bg-gray-100"></div>
          {renderCell(15)}
        </div>
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-4 grid grid-cols-4">
            {[16, 17, 18, 19].map(pos => renderCell(pos))}
          </div>
          <div className="col-span-2"></div>
        </div>

        {/* Center Row - Home area */}
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-2"></div>
          <div className="col-span-4 grid grid-cols-4">
            {[47, 46, 45, 44].map(pos => renderCell(pos))}
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3 relative">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            <div className="flex items-start justify-center">{renderHomeTriangle('red')}</div>
            <div className="flex items-start justify-center">{renderHomeTriangle('blue')}</div>
            <div className="flex items-end justify-center">{renderHomeTriangle('green')}</div>
            <div className="flex items-end justify-center">{renderHomeTriangle('yellow')}</div>
          </div>
        </div>
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-4 grid grid-cols-4">
            {[20, 21, 22, 23].map(pos => renderCell(pos))}
          </div>
          <div className="col-span-2"></div>
        </div>

        {/* Row 5 - Vertical paths */}
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-2"></div>
          <div className="col-span-4 grid grid-cols-4">
            {[43, 42, 41, 40].map(pos => renderCell(pos))}
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3">
          {renderCell(26)}
          <div className="bg-gray-100"></div>
          {renderCell(24)}
        </div>
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-4 grid grid-cols-4">
            {[25, 26, 27, 28].map(pos => renderCell(pos))}
          </div>
          <div className="col-span-2"></div>
        </div>

        {/* Row 6 - Bottom private areas */}
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-2">{renderPrivateArea('green')}</div>
          <div className="col-span-4 grid grid-cols-4">
            {renderLastLine('green')}
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3">
          {renderCell(39)}
          <div className="bg-gray-100"></div>
          {renderCell(27)}
        </div>
        <div className="col-span-6 grid grid-cols-6">
          <div className="col-span-4 grid grid-cols-4">
            {renderLastLine('yellow').reverse()}
          </div>
          <div className="col-span-2">{renderPrivateArea('yellow')}</div>
        </div>

        {/* Row 7 - Bottom */}
        <div className="col-span-6 grid grid-cols-6">
          {[38, 37, 36, 35, 34, 33].map(pos => renderCell(pos))}
        </div>
        <div className="col-span-3 grid grid-cols-3">
          <div></div>
          {renderCell(40)}
          <div></div>
        </div>
        <div className="col-span-6 grid grid-cols-6">
          {[32, 31, 30, 29, 28, 27].map(pos => renderCell(pos))}
        </div>
      </div>

      {/* Dice Section */}
      <div className="flex items-center space-x-4">
        <Button
          onClick={onDiceRoll}
          disabled={!canRoll || isRolling}
          className={cn(
            "flex items-center space-x-2 px-6 py-3 text-lg font-bold",
            currentPlayer === 'blue' && "bg-blue-500 hover:bg-blue-600",
            currentPlayer === 'red' && "bg-red-500 hover:bg-red-600",
            currentPlayer === 'green' && "bg-green-500 hover:bg-green-600",
            currentPlayer === 'yellow' && "bg-yellow-500 hover:bg-yellow-600",
            isRolling && "animate-pulse"
          )}
        >
          <DiceIcon className="w-6 h-6" />
          <span>{isRolling ? 'Rolling...' : `Roll Dice (${diceValue})`}</span>
        </Button>
      </div>
    </div>
  );
}
