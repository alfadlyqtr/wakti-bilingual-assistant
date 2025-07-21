
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
  currentPlayer: string;
  diceValue: number;
  onDiceRoll: () => void;
  isRolling: boolean;
  canRoll: boolean;
}

const COLORS = {
  red: '#ff0000',
  green: '#07c107',
  blue: '#2311db',
  yellow: '#ffd100'
};

export function LudoBoardV2({ 
  gameState, 
  highlightedPawns, 
  onPawnClick, 
  currentPlayer, 
  diceValue, 
  onDiceRoll, 
  isRolling, 
  canRoll 
}: LudoBoardProps) {
  const renderPawn = (pawn: Pawn, scale = 1) => {
    const isHighlighted = highlightedPawns.has(pawn.name);
    
    return (
      <div
        key={pawn.name}
        className={cn(
          "absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer z-10",
          isHighlighted && "animate-pulse"
        )}
        style={{ transform: `scale(${scale})` }}
        onClick={() => onPawnClick(pawn)}
      >
        <div
          className={cn(
            "w-full h-full rounded-full flex items-center justify-center border-2 border-white shadow-lg",
            isHighlighted && "ring-4 ring-yellow-400 ring-opacity-75 shadow-yellow-400"
          )}
          style={{ backgroundColor: COLORS[pawn.color] }}
        >
          <img 
            src={`/lovable-uploads/pawn-${pawn.color}.png`} 
            alt={pawn.name}
            className="w-4/5 h-4/5 object-contain"
          />
        </div>
      </div>
    );
  };

  const renderCell = (cellId: string, additionalClasses?: string) => {
    const cellNumber = parseInt(cellId.replace('out-', ''));
    const pawns = gameState.outerPosition[cellNumber] || [];
    const isSafe = [1, 9, 14, 22, 27, 35, 40, 48].includes(cellNumber);
    
    return (
      <div
        key={cellId}
        className={cn(
          "relative border border-gray-300 bg-white flex items-center justify-center",
          additionalClasses
        )}
        style={{ 
          width: 'calc(650px / 15)', 
          height: 'calc(650px / 15)',
          backgroundColor: cellNumber === 1 ? COLORS.blue : 
                          cellNumber === 14 ? COLORS.red :
                          cellNumber === 27 ? COLORS.green :
                          cellNumber === 40 ? COLORS.yellow : 'white'
        }}
      >
        {pawns.map((pawn, index) => (
          <div key={pawn.name} className={index > 0 ? "absolute top-0 left-0 transform scale-75" : ""}>
            {renderPawn(pawn)}
          </div>
        ))}
        
        {pawns.length > 1 && (
          <div className="absolute top-0 right-0 bg-black text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {pawns.length}
          </div>
        )}
        
        {isSafe && (
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
    
    return (
      <div 
        className="flex items-center justify-center"
        style={{ 
          width: 'calc(650px / 15 * 6)', 
          height: 'calc(650px / 15 * 6)',
          backgroundColor: COLORS[color]
        }}
      >
        <div 
          className="bg-white grid grid-cols-2 gap-2 p-2 rounded"
          style={{ 
            width: 'calc(650px / 15 * 4)', 
            height: 'calc(650px / 15 * 4)'
          }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-gray-100 rounded-full aspect-square relative flex items-center justify-center">
              {pawns[i] && renderPawn(pawns[i])}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLastLineCell = (color: 'blue' | 'red' | 'green' | 'yellow', position: number) => {
    const pawns = gameState.lastLine[color]?.[position] || [];
    
    return (
      <div
        key={`${color}-last-line-${position}`}
        className="relative border border-gray-300 flex items-center justify-center"
        style={{ 
          width: 'calc(650px / 15)', 
          height: 'calc(650px / 15)',
          backgroundColor: COLORS[color]
        }}
      >
        {pawns.map((pawn, index) => (
          <div key={pawn.name} className={index > 0 ? "absolute top-0 left-0 transform scale-75" : ""}>
            {renderPawn(pawn)}
          </div>
        ))}
        
        {pawns.length > 1 && (
          <div className="absolute top-0 right-0 bg-black text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {pawns.length}
          </div>
        )}
      </div>
    );
  };

  const renderHomeArea = (color: 'blue' | 'red' | 'green' | 'yellow') => {
    const pawns = gameState.homeAreas[color] || [];
    
    return (
      <div className="flex flex-col items-center justify-center">
        {Array.from({ length: 4 }, (_, i) => (
          <div 
            key={i} 
            className="w-4 h-4 rounded-full border border-gray-300 mb-1 relative"
            style={{ backgroundColor: COLORS[color] }}
          >
            {pawns[i] && renderPawn(pawns[i], 1.3)}
          </div>
        ))}
      </div>
    );
  };

  const renderDiceSection = () => {
    const getDiceClass = (value: number) => {
      const positions = ['0%', '20%', '40%', '60%', '80%', '100%'];
      return positions[value - 1] || '0%';
    };

    return (
      <div 
        className={cn(
          "w-25 h-25 rounded-3xl border-4 border-white flex items-center justify-center cursor-pointer absolute -top-5 left-1/2 transform -translate-x-1/2 transition-all duration-200",
          canRoll && "hover:scale-105",
          !canRoll && "opacity-50 cursor-not-allowed"
        )}
        style={{ 
          backgroundColor: COLORS[currentPlayer as keyof typeof COLORS],
          width: '100px',
          height: '100px'
        }}
        onClick={canRoll ? onDiceRoll : undefined}
      >
        <div
          className={cn(
            "w-4/5 h-4/5 bg-cover transition-all duration-300",
            isRolling && "animate-spin"
          )}
          style={{
            backgroundImage: isRolling 
              ? `url(/lovable-uploads/diceRoll.png)`
              : `url(/lovable-uploads/diceValues.png)`,
            backgroundPositionX: isRolling ? '0%' : getDiceClass(diceValue),
            backgroundSize: isRolling ? 'cover' : '600% 100%'
          }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Main Board */}
      <div 
        className="bg-white rounded-lg border-4 border-white relative"
        style={{ 
          width: '650px', 
          height: '650px',
          backgroundImage: `url(/lovable-uploads/bg.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Section 1 - Top */}
        <div className="flex absolute top-0 left-0 w-full" style={{ height: 'calc(650px / 15 * 6)' }}>
          {/* Red Private Area */}
          {renderPrivateArea('red')}
          
          {/* Top Track */}
          <div className="flex flex-col">
            {/* Row 1 */}
            <div className="flex">
              {renderCell('out-24')}
              {renderCell('out-25')}
              {renderCell('out-26')}
            </div>
            
            {/* Row 2 */}
            <div className="flex">
              {renderCell('out-23')}
              {renderLastLineCell('green', 1)}
              {renderCell('out-27')}
            </div>
            
            {/* Row 3 */}
            <div className="flex">
              {renderCell('out-22')}
              {renderLastLineCell('green', 2)}
              {renderCell('out-28')}
            </div>
            
            {/* Row 4 */}
            <div className="flex">
              {renderCell('out-21')}
              {renderLastLineCell('green', 3)}
              {renderCell('out-29')}
            </div>
            
            {/* Row 5 */}
            <div className="flex">
              {renderCell('out-20')}
              {renderLastLineCell('green', 4)}
              {renderCell('out-30')}
            </div>
            
            {/* Row 6 */}
            <div className="flex">
              {renderCell('out-19')}
              {renderLastLineCell('green', 5)}
              {renderCell('out-31')}
            </div>
          </div>
          
          {/* Green Private Area */}
          {renderPrivateArea('green')}
        </div>

        {/* Section 2 - Middle */}
        <div 
          className="flex absolute left-0 w-full" 
          style={{ 
            top: 'calc(650px / 15 * 6)', 
            height: 'calc(650px / 15 * 3)' 
          }}
        >
          {/* Left Track */}
          <div className="flex flex-col">
            <div className="flex">
              {renderCell('out-13')}
              {renderCell('out-14')}
              {renderCell('out-15')}
              {renderCell('out-16')}
              {renderCell('out-17')}
              {renderCell('out-18')}
            </div>
            
            <div className="flex">
              {renderCell('out-12')}
              {renderLastLineCell('red', 1)}
              {renderLastLineCell('red', 2)}
              {renderLastLineCell('red', 3)}
              {renderLastLineCell('red', 4)}
              {renderLastLineCell('red', 5)}
            </div>
            
            <div className="flex">
              {renderCell('out-11')}
              {renderCell('out-10')}
              {renderCell('out-9')}
              {renderCell('out-8')}
              {renderCell('out-7')}
              {renderCell('out-6')}
            </div>
          </div>
          
          {/* Center Home Area */}
          <div 
            className="bg-gray-100 relative"
            style={{ 
              width: 'calc(650px / 15 * 3)', 
              height: 'calc(650px / 15 * 3)' 
            }}
          >
            {/* Green Home */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
              {renderHomeArea('green')}
            </div>
            
            {/* Red Home */}
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
              {renderHomeArea('red')}
            </div>
            
            {/* Yellow Home */}
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              {renderHomeArea('yellow')}
            </div>
            
            {/* Blue Home */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2">
              {renderHomeArea('blue')}
            </div>
          </div>
          
          {/* Right Track */}
          <div className="flex flex-col">
            <div className="flex">
              {renderCell('out-32')}
              {renderCell('out-33')}
              {renderCell('out-34')}
              {renderCell('out-35')}
              {renderCell('out-36')}
              {renderCell('out-37')}
            </div>
            
            <div className="flex">
              {renderLastLineCell('yellow', 5)}
              {renderLastLineCell('yellow', 4)}
              {renderLastLineCell('yellow', 3)}
              {renderLastLineCell('yellow', 2)}
              {renderLastLineCell('yellow', 1)}
              {renderCell('out-38')}
            </div>
            
            <div className="flex">
              {renderCell('out-44')}
              {renderCell('out-43')}
              {renderCell('out-42')}
              {renderCell('out-41')}
              {renderCell('out-40')}
              {renderCell('out-39')}
            </div>
          </div>
        </div>

        {/* Section 3 - Bottom */}
        <div 
          className="flex absolute bottom-0 left-0 w-full" 
          style={{ height: 'calc(650px / 15 * 6)' }}
        >
          {/* Blue Private Area */}
          {renderPrivateArea('blue')}
          
          {/* Bottom Track */}
          <div className="flex flex-col">
            {/* Row 1 */}
            <div className="flex">
              {renderCell('out-5')}
              {renderLastLineCell('blue', 5)}
              {renderCell('out-45')}
            </div>
            
            {/* Row 2 */}
            <div className="flex">
              {renderCell('out-4')}
              {renderLastLineCell('blue', 4)}
              {renderCell('out-46')}
            </div>
            
            {/* Row 3 */}
            <div className="flex">
              {renderCell('out-3')}
              {renderLastLineCell('blue', 3)}
              {renderCell('out-47')}
            </div>
            
            {/* Row 4 */}
            <div className="flex">
              {renderCell('out-2')}
              {renderLastLineCell('blue', 2)}
              {renderCell('out-48')}
            </div>
            
            {/* Row 5 */}
            <div className="flex">
              {renderCell('out-1')}
              {renderLastLineCell('blue', 1)}
              {renderCell('out-49')}
            </div>
            
            {/* Row 6 */}
            <div className="flex">
              {renderCell('out-52')}
              {renderCell('out-51')}
              {renderCell('out-50')}
            </div>
          </div>
          
          {/* Yellow Private Area */}
          {renderPrivateArea('yellow')}
        </div>
      </div>

      {/* Dashboard */}
      <div 
        className="w-full mt-10 h-18 rounded-lg border-4 border-white flex justify-around items-center text-white text-2xl font-bold relative"
        style={{ 
          backgroundColor: COLORS[currentPlayer as keyof typeof COLORS],
          maxWidth: '650px'
        }}
      >
        <div className="flex items-center">
          <span className="capitalize">{currentPlayer}'s turn</span>
        </div>
        
        {renderDiceSection()}
        
        <div className="flex items-center">
          <span>{diceValue}</span>
        </div>
      </div>
    </div>
  );
}
