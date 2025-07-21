
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

export function LudoBoard({ gameState, highlightedPawns, onPawnClick }: LudoBoardProps) {
  const renderPawn = (pawn: Pawn) => {
    const isHighlighted = highlightedPawns.has(pawn.name);
    
    return (
      <div
        key={pawn.name}
        className={cn(
          "w-6 h-6 rounded-full border-2 border-white cursor-pointer transition-all duration-200",
          "flex items-center justify-center text-xs font-bold text-white",
          pawn.color === 'blue' && "bg-blue-600",
          pawn.color === 'red' && "bg-red-600",
          pawn.color === 'green' && "bg-green-600",
          pawn.color === 'yellow' && "bg-yellow-500",
          isHighlighted && "ring-4 ring-yellow-400 ring-opacity-75 animate-pulse scale-110",
          "hover:scale-110 shadow-lg"
        )}
        onClick={() => onPawnClick(pawn)}
      >
        {pawn.id}
      </div>
    );
  };

  const renderCell = (cellId: string, isStart?: boolean, isSafe?: boolean) => {
    const pawns = gameState.outerPosition[parseInt(cellId.replace('out-', ''))] || [];
    
    return (
      <div
        key={cellId}
        className={cn(
          "w-8 h-8 border border-gray-300 flex items-center justify-center relative",
          "bg-white",
          isStart && "bg-blue-100",
          isSafe && "bg-yellow-100",
          pawns.length > 0 && "bg-gray-50"
        )}
      >
        {pawns.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {pawns.length === 1 ? (
              renderPawn(pawns[0])
            ) : (
              <div className="text-xs font-bold text-gray-700">
                {pawns.length}
              </div>
            )}
          </div>
        )}
        
        {isSafe && (
          <div className="absolute top-0 right-0 text-yellow-600 text-xs">
            ⭐
          </div>
        )}
      </div>
    );
  };

  const renderPrivateArea = (color: string) => {
    const pawns = gameState.privateAreas[color] || [];
    const colorClass = {
      blue: 'bg-blue-200',
      red: 'bg-red-200',
      green: 'bg-green-200',
      yellow: 'bg-yellow-200'
    };

    return (
      <div className={cn("w-24 h-24 rounded-lg p-2 border-2", colorClass[color as keyof typeof colorClass])}>
        <div className="grid grid-cols-2 gap-1 h-full">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-white rounded-full flex items-center justify-center">
              {pawns[i] && renderPawn(pawns[i])}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHomeArea = (color: string) => {
    const pawns = gameState.homeAreas[color] || [];
    const colorClass = {
      blue: 'bg-blue-300',
      red: 'bg-red-300',
      green: 'bg-green-300',
      yellow: 'bg-yellow-300'
    };

    return (
      <div className={cn("w-16 h-16 rounded-lg p-1 border-2", colorClass[color as keyof typeof colorClass])}>
        <div className="grid grid-cols-2 gap-1 h-full">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-white rounded-full flex items-center justify-center">
              {pawns[i] && renderPawn(pawns[i])}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLastLine = (color: string) => {
    const lastLine = gameState.lastLine[color] || {};
    const colorClass = {
      blue: 'bg-blue-400',
      red: 'bg-red-400',
      green: 'bg-green-400',
      yellow: 'bg-yellow-400'
    };

    return (
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => {
          const pos = i + 1;
          const pawns = lastLine[pos] || [];
          
          return (
            <div
              key={pos}
              className={cn(
                "w-8 h-8 border border-gray-300 flex items-center justify-center",
                colorClass[color as keyof typeof colorClass]
              )}
            >
              {pawns.length > 0 && renderPawn(pawns[0])}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      <div className="relative w-80 h-80 mx-auto">
        {/* Simplified Ludo board layout */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2">
          {/* Top row */}
          <div className="flex items-center justify-center">
            {renderPrivateArea('red')}
          </div>
          <div className="flex flex-col items-center justify-center">
            {renderLastLine('red')}
          </div>
          <div className="flex items-center justify-center">
            {renderPrivateArea('green')}
          </div>
          
          {/* Middle row */}
          <div className="flex items-center justify-center">
            {renderLastLine('blue')}
          </div>
          <div className="flex items-center justify-center">
            <div className="grid grid-cols-2 grid-rows-2 gap-2">
              {renderHomeArea('red')}
              {renderHomeArea('green')}
              {renderHomeArea('blue')}
              {renderHomeArea('yellow')}
            </div>
          </div>
          <div className="flex items-center justify-center">
            {renderLastLine('green')}
          </div>
          
          {/* Bottom row */}
          <div className="flex items-center justify-center">
            {renderPrivateArea('blue')}
          </div>
          <div className="flex flex-col items-center justify-center">
            {renderLastLine('yellow')}
          </div>
          <div className="flex items-center justify-center">
            {renderPrivateArea('yellow')}
          </div>
        </div>
      </div>
    </div>
  );
}
