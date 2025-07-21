
import React from 'react';
import { cn } from '@/lib/utils';

interface Pawn {
  id: number;
  name: string;
  color: 'blue' | 'red' | 'green' | 'yellow';
  currentCell: string;
  area: 'private' | 'outer' | 'last-line' | 'home';
}

interface LudoBoardProps {
  gameState: {
    privateAreas: Record<string, Pawn[]>;
    outerPosition: Record<number, Pawn[]>;
    lastLine: Record<string, Record<number, Pawn[]>>;
    homeAreas: Record<string, Pawn[]>;
  };
  highlightedPawns: Set<string>;
  onPawnClick: (pawn: Pawn) => void;
}

const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];

export function LudoBoard({ gameState, highlightedPawns, onPawnClick }: LudoBoardProps) {
  const renderPawn = (pawn: Pawn) => {
    const isHighlighted = highlightedPawns.has(pawn.name);
    
    return (
      <div
        key={pawn.name}
        className={cn(
          "absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer",
          "transition-all duration-200 z-10",
          isHighlighted && "animate-pulse"
        )}
        onClick={() => onPawnClick(pawn)}
      >
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center",
            "border-2 border-white shadow-lg transition-all duration-200",
            isHighlighted && "ring-4 ring-yellow-400 ring-opacity-75 scale-110"
          )}
        >
          <img 
            src={`/lovable-uploads/pawn-${pawn.color}.png`} 
            alt={pawn.name}
            className="w-6 h-6 object-contain"
          />
        </div>
      </div>
    );
  };

  const renderCell = (cellNumber: number, isSpecial?: boolean) => {
    const pawns = gameState.outerPosition[cellNumber] || [];
    const isSafe = SAFE_POSITIONS.includes(cellNumber);
    const isStart = cellNumber === 1 || cellNumber === 14 || cellNumber === 27 || cellNumber === 40;
    
    return (
      <div
        key={cellNumber}
        className={cn(
          "w-8 h-8 border border-gray-300 bg-white relative flex items-center justify-center",
          cellNumber === 1 && "bg-blue-200",
          cellNumber === 14 && "bg-red-200", 
          cellNumber === 27 && "bg-green-200",
          cellNumber === 40 && "bg-yellow-200",
          isSafe && !isStart && "bg-yellow-100"
        )}
      >
        {pawns.map((pawn, index) => (
          <div key={pawn.name} className={index > 0 ? "hidden" : ""}>
            {renderPawn(pawn)}
          </div>
        ))}
        
        {pawns.length > 1 && (
          <div className="absolute top-0 right-0 bg-black text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {pawns.length}
          </div>
        )}
        
        {isSafe && !isStart && (
          <div className="absolute top-0 left-0">
            <img 
              src="/lovable-uploads/star.png" 
              alt="Safe position"
              className="w-3 h-3 object-contain"
            />
          </div>
        )}
      </div>
    );
  };

  const renderPrivateArea = (color: 'blue' | 'red' | 'green' | 'yellow') => {
    const pawns = gameState.privateAreas[color] || [];
    const colorClasses = {
      blue: 'bg-blue-200',
      red: 'bg-red-200', 
      green: 'bg-green-200',
      yellow: 'bg-yellow-200'
    };

    return (
      <div className={cn(
        "w-48 h-48 rounded-lg p-4 border-2 border-gray-400",
        colorClasses[color]
      )}>
        <div className="bg-white w-32 h-32 mx-auto rounded-lg grid grid-cols-2 gap-2 p-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-gray-100 rounded-full aspect-square relative flex items-center justify-center">
              {pawns[i] && renderPawn(pawns[i])}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLastLine = (color: 'blue' | 'red' | 'green' | 'yellow', direction: 'horizontal' | 'vertical') => {
    const lastLine = gameState.lastLine[color] || {};
    const colorClasses = {
      blue: 'bg-blue-400',
      red: 'bg-red-400',
      green: 'bg-green-400', 
      yellow: 'bg-yellow-400'
    };

    return (
      <div className={cn(
        "flex",
        direction === 'vertical' ? "flex-col" : "flex-row"
      )}>
        {Array.from({ length: 5 }, (_, i) => {
          const pos = i + 1;
          const pawns = lastLine[pos] || [];
          
          return (
            <div
              key={pos}
              className={cn(
                "w-8 h-8 border border-gray-300 relative flex items-center justify-center",
                colorClasses[color]
              )}
            >
              {pawns.map((pawn, index) => (
                <div key={pawn.name} className={index > 0 ? "hidden" : ""}>
                  {renderPawn(pawn)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderHomeArea = (color: 'blue' | 'red' | 'green' | 'yellow') => {
    const pawns = gameState.homeAreas[color] || [];
    const colorClasses = {
      blue: 'bg-blue-300',
      red: 'bg-red-300',
      green: 'bg-green-300',
      yellow: 'bg-yellow-300'
    };

    return (
      <div className={cn(
        "w-16 h-16 rounded-lg p-1 border-2 border-gray-400 grid grid-cols-2 gap-1",
        colorClasses[color]
      )}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-white rounded-full aspect-square relative flex items-center justify-center">
            {pawns[i] && (
              <div className="scale-75">
                {renderPawn(pawns[i])}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-lg shadow-lg p-2 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 rounded-lg"
        style={{
          backgroundImage: `url(/lovable-uploads/bg.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.3
        }}
      />
      
      {/* Complete 15x15 Ludo Board */}
      <div className="w-full aspect-square bg-white/90 rounded-lg relative backdrop-blur-sm">
        {/* Top Section */}
        <div className="absolute top-0 left-0 w-full h-2/5 flex">
          {/* Red Private Area */}
          <div className="w-2/5 h-full flex items-center justify-center">
            {renderPrivateArea('red')}
          </div>
          
          {/* Top Track */}
          <div className="w-1/5 h-full flex flex-col">
            {/* Cells 24-26 */}
            <div className="flex h-1/6">
              {[24, 25, 26].map(num => renderCell(num))}
            </div>
            {/* Red last line + Cell 27 */}
            <div className="flex h-1/6">
              {renderCell(23)}
              <div className="w-8 h-8 bg-red-400 border border-gray-300"></div>
              {renderCell(27)}
            </div>
            {/* Continue pattern for remaining rows */}
            <div className="flex h-1/6">
              {renderCell(22)}
              <div className="w-8 h-8 bg-red-400 border border-gray-300"></div>
              {renderCell(28)}
            </div>
            <div className="flex h-1/6">
              {renderCell(21)}
              <div className="w-8 h-8 bg-red-400 border border-gray-300"></div>
              {renderCell(29)}
            </div>
            <div className="flex h-1/6">
              {renderCell(20)}
              <div className="w-8 h-8 bg-red-400 border border-gray-300"></div>
              {renderCell(30)}
            </div>
            <div className="flex h-1/6">
              {renderCell(19)}
              <div className="w-8 h-8 bg-red-400 border border-gray-300"></div>
              {renderCell(31)}
            </div>
          </div>
          
          {/* Green Private Area */}
          <div className="w-2/5 h-full flex items-center justify-center">
            {renderPrivateArea('green')}
          </div>
        </div>

        {/* Middle Section */}
        <div className="absolute top-2/5 left-0 w-full h-1/5 flex">
          {/* Left Track */}
          <div className="w-2/5 h-full flex flex-col">
            {/* Row 1 */}
            <div className="flex h-1/2">
              {[13, 14, 15, 16, 17, 18].map(num => renderCell(num))}
            </div>
            {/* Row 2 */}
            <div className="flex h-1/2">
              {[12, 11, 10, 9, 8, 7].map(num => renderCell(num))}
            </div>
          </div>
          
          {/* Center Home Area */}
          <div className="w-1/5 h-full flex items-center justify-center bg-gray-100">
            <div className="grid grid-cols-2 gap-2">
              {renderHomeArea('red')}
              {renderHomeArea('green')}
              {renderHomeArea('blue')}
              {renderHomeArea('yellow')}
            </div>
          </div>
          
          {/* Right Track */}
          <div className="w-2/5 h-full flex flex-col">
            {/* Row 1 */}
            <div className="flex h-1/2">
              {[32, 33, 34, 35, 36, 37].map(num => renderCell(num))}
            </div>
            {/* Row 2 */}
            <div className="flex h-1/2">
              {[44, 43, 42, 41, 40, 39].map(num => renderCell(num))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 w-full h-2/5 flex">
          {/* Blue Private Area */}
          <div className="w-2/5 h-full flex items-center justify-center">
            {renderPrivateArea('blue')}
          </div>
          
          {/* Bottom Track */}
          <div className="w-1/5 h-full flex flex-col">
            {/* Bottom track cells */}
            <div className="flex h-1/6">
              {renderCell(5)}
              <div className="w-8 h-8 bg-blue-400 border border-gray-300"></div>
              {renderCell(45)}
            </div>
            {/* Continue pattern */}
            <div className="flex h-1/6">
              {renderCell(4)}
              <div className="w-8 h-8 bg-blue-400 border border-gray-300"></div>
              {renderCell(46)}
            </div>
            <div className="flex h-1/6">
              {renderCell(3)}
              <div className="w-8 h-8 bg-blue-400 border border-gray-300"></div>
              {renderCell(47)}
            </div>
            <div className="flex h-1/6">
              {renderCell(2)}
              <div className="w-8 h-8 bg-blue-400 border border-gray-300"></div>
              {renderCell(48)}
            </div>
            <div className="flex h-1/6">
              {renderCell(1)}
              <div className="w-8 h-8 bg-blue-400 border border-gray-300"></div>
              {renderCell(49)}
            </div>
            <div className="flex h-1/6">
              {[52, 51, 50].map(num => renderCell(num))}
            </div>
          </div>
          
          {/* Yellow Private Area */}
          <div className="w-2/5 h-full flex items-center justify-center">
            {renderPrivateArea('yellow')}
          </div>
        </div>
      </div>
    </div>
  );
}
