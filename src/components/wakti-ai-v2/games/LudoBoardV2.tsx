
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
  isAIThinking?: boolean;
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
  canRoll,
  isAIThinking = false
}: LudoBoardV2Props) {
  const DiceIcon = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6][diceValue - 1];

  const renderPawn = (pawn: Pawn, isHighlighted: boolean = false) => (
    <div
      key={pawn.name}
      className={cn(
        "absolute w-7 h-7 rounded-full border-2 cursor-pointer transition-all duration-200 z-10",
        "flex items-center justify-center text-xs font-bold text-white",
        pawn.color === 'blue' && "bg-blue-600 border-blue-800",
        pawn.color === 'red' && "bg-red-500 border-red-700",
        pawn.color === 'green' && "bg-green-500 border-green-700",
        pawn.color === 'yellow' && "bg-yellow-500 border-yellow-700",
        isHighlighted && "scale-125 shadow-lg ring-4 ring-yellow-400 border-black border-dashed animate-pulse",
        "hover:scale-110"
      )}
      onClick={() => onPawnClick(pawn)}
      title={`${pawn.color} pawn ${pawn.id}`}
    >
      {pawn.id}
    </div>
  );

  const renderCell = (cellId: string, pawns: Pawn[] = [], isSafe: boolean = false, isStart: boolean = false) => {
    return (
      <div
        className={cn(
          "relative w-full h-full border border-gray-300 flex items-center justify-center",
          isSafe && "bg-yellow-100",
          isStart && cellId.includes('out-1') && "bg-blue-200",
          isStart && cellId.includes('out-14') && "bg-red-200", 
          isStart && cellId.includes('out-27') && "bg-green-200",
          isStart && cellId.includes('out-40') && "bg-yellow-200",
          isSafe && "bg-star bg-center bg-no-repeat bg-contain"
        )}
        style={{
          backgroundImage: isSafe ? "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTUuMDkgOC4yNkwyMiA5TDE3IDEzLjc0TDE4LjE4IDIyTDEyIDE4Ljc3TDUuODIgMjJMNyAxMy43NEwyIDlMOC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkZENzAwIiBzdHJva2U9IiNGQkIwMTgiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4K')" : undefined,
          backgroundSize: isSafe ? '60%' : undefined
        }}
      >
        {pawns.map((pawn, index) => (
          <div key={pawn.name} style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translate(${(index % 2) * 8 - 4}px, ${Math.floor(index / 2) * 8 - 4}px)`
          }}>
            {renderPawn(pawn, highlightedPawns.has(pawn.name))}
          </div>
        ))}
      </div>
    );
  };

  const renderPrivateArea = (color: PlayerColor) => {
    const pawns = gameState.privateAreas[color] || [];
    return (
      <div className={cn(
        "w-full h-full flex items-center justify-center p-2",
        color === 'blue' && "bg-blue-500",
        color === 'red' && "bg-red-500",
        color === 'green' && "bg-green-500",
        color === 'yellow' && "bg-yellow-500"
      )}>
        <div className="bg-white w-4/5 h-4/5 rounded grid grid-cols-2 gap-1 p-1">
          {[0, 1, 2, 3].map(index => (
            <div key={index} className="relative rounded-full bg-white border border-gray-300 flex items-center justify-center">
              {pawns[index] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {renderPawn(pawns[index], highlightedPawns.has(pawns[index].name))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHomeArea = () => {
    return (
      <div className="relative w-full h-full bg-white border border-gray-400">
        {/* Red home (top triangle) */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-10 flex items-end justify-center">
          <div className="flex space-x-1">
            {(gameState.homeAreas.red || []).slice(0, 4).map((pawn, index) => (
              <div key={pawn.name} className="w-3 h-3">
                {renderPawn(pawn, highlightedPawns.has(pawn.name))}
              </div>
            ))}
          </div>
        </div>

        {/* Green home (left triangle) */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-10 h-16 flex items-center justify-end">
          <div className="flex flex-col space-y-1">
            {(gameState.homeAreas.green || []).slice(0, 4).map((pawn, index) => (
              <div key={pawn.name} className="w-3 h-3">
                {renderPawn(pawn, highlightedPawns.has(pawn.name))}
              </div>
            ))}
          </div>
        </div>

        {/* Blue home (bottom triangle) */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-10 flex items-start justify-center">
          <div className="flex space-x-1">
            {(gameState.homeAreas.blue || []).slice(0, 4).map((pawn, index) => (
              <div key={pawn.name} className="w-3 h-3">
                {renderPawn(pawn, highlightedPawns.has(pawn.name))}
              </div>
            ))}
          </div>
        </div>

        {/* Yellow home (right triangle) */}
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-10 h-16 flex items-center justify-start">
          <div className="flex flex-col space-y-1">
            {(gameState.homeAreas.yellow || []).slice(0, 4).map((pawn, index) => (
              <div key={pawn.name} className="w-3 h-3">
                {renderPawn(pawn, highlightedPawns.has(pawn.name))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4 max-w-lg mx-auto">
      {/* Current Player Indicator */}
      <div className="text-center mb-2">
        <div className={cn(
          "px-4 py-2 rounded-lg text-white text-lg font-bold",
          currentPlayer === 'blue' && "bg-blue-500",
          currentPlayer === 'red' && "bg-red-500",
          currentPlayer === 'green' && "bg-green-500",
          currentPlayer === 'yellow' && "bg-yellow-500"
        )}>
          {currentPlayer.toUpperCase()}'s Turn
          {isAIThinking && <span className="ml-2 animate-pulse">Thinking...</span>}
        </div>
      </div>

      {/* Game Board - Exact 3-section layout from original */}
      <div className="bg-white rounded-lg border-4 border-white" style={{ width: '400px', height: '400px' }}>
        
        {/* Section 1 - Top */}
        <div className="flex" style={{ height: '160px' }}>
          {/* Red Private Area */}
          <div style={{ width: '160px', height: '160px' }}>
            {renderPrivateArea('red')}
          </div>
          
          {/* Top Track - 6x3 grid */}
          <div className="flex-1 grid grid-cols-6 grid-rows-3" style={{ width: '160px' }}>
            {/* Row 1 */}
            {renderCell('out-24', gameState.outerPosition[24])}
            {renderCell('out-25', gameState.outerPosition[25])}
            {renderCell('out-26', gameState.outerPosition[26])}
            {renderCell('out-27', gameState.outerPosition[27], false, true)}
            {renderCell('out-28', gameState.outerPosition[28])}
            {renderCell('out-29', gameState.outerPosition[29])}
            
            {/* Row 2 */}
            {renderCell('out-23', gameState.outerPosition[23])}
            {renderCell('green-last-line-1', gameState.lastLine.green?.[1])}
            {renderCell('green-last-line-2', gameState.lastLine.green?.[2])}
            {renderCell('green-last-line-3', gameState.lastLine.green?.[3])}
            {renderCell('green-last-line-4', gameState.lastLine.green?.[4])}
            {renderCell('out-30', gameState.outerPosition[30])}
            
            {/* Row 3 */}
            {renderCell('out-22', gameState.outerPosition[22], SAFE_POSITIONS.includes(22))}
            {renderCell('green-last-line-5', gameState.lastLine.green?.[5])}
            {renderCell('out-31', gameState.outerPosition[31])}
            {renderCell('out-32', gameState.outerPosition[32])}
            {renderCell('out-33', gameState.outerPosition[33])}
            {renderCell('out-34', gameState.outerPosition[34])}
          </div>
          
          {/* Green Private Area */}
          <div style={{ width: '160px', height: '160px' }}>
            {renderPrivateArea('green')}
          </div>
        </div>

        {/* Section 2 - Middle */}
        <div className="flex" style={{ height: '80px' }}>
          {/* Left Track */}
          <div className="grid grid-cols-6" style={{ width: '160px' }}>
            {renderCell('out-21', gameState.outerPosition[21])}
            {renderCell('out-20', gameState.outerPosition[20])}
            {renderCell('out-19', gameState.outerPosition[19])}
            {renderCell('out-18', gameState.outerPosition[18])}
            {renderCell('out-17', gameState.outerPosition[17])}
            {renderCell('out-16', gameState.outerPosition[16])}
          </div>
          
          {/* Center Home Area */}
          <div style={{ width: '80px', height: '80px' }}>
            {renderHomeArea()}
          </div>
          
          {/* Right Track */}
          <div className="grid grid-cols-6" style={{ width: '160px' }}>
            {renderCell('out-35', gameState.outerPosition[35], SAFE_POSITIONS.includes(35))}
            {renderCell('out-36', gameState.outerPosition[36])}
            {renderCell('out-37', gameState.outerPosition[37])}
            {renderCell('out-38', gameState.outerPosition[38])}
            {renderCell('out-39', gameState.outerPosition[39])}
            {renderCell('out-40', gameState.outerPosition[40], false, true)}
          </div>
        </div>

        {/* Section 3 - Bottom */}
        <div className="flex" style={{ height: '160px' }}>
          {/* Blue Private Area */}
          <div style={{ width: '160px', height: '160px' }}>
            {renderPrivateArea('blue')}
          </div>
          
          {/* Bottom Track - 6x3 grid */}
          <div className="flex-1 grid grid-cols-6 grid-rows-3" style={{ width: '160px' }}>
            {/* Row 1 */}
            {renderCell('out-15', gameState.outerPosition[15])}
            {renderCell('out-14', gameState.outerPosition[14], false, true)}
            {renderCell('out-13', gameState.outerPosition[13])}
            {renderCell('out-12', gameState.outerPosition[12])}
            {renderCell('out-11', gameState.outerPosition[11])}
            {renderCell('out-10', gameState.outerPosition[10])}
            
            {/* Row 2 - Red last line */}
            {renderCell('red-last-line-5', gameState.lastLine.red?.[5])}
            {renderCell('red-last-line-4', gameState.lastLine.red?.[4])}
            {renderCell('red-last-line-3', gameState.lastLine.red?.[3])}
            {renderCell('red-last-line-2', gameState.lastLine.red?.[2])}
            {renderCell('red-last-line-1', gameState.lastLine.red?.[1])}
            {renderCell('out-9', gameState.outerPosition[9], SAFE_POSITIONS.includes(9))}
            
            {/* Row 3 */}
            {renderCell('out-8', gameState.outerPosition[8])}
            {renderCell('out-7', gameState.outerPosition[7])}
            {renderCell('out-6', gameState.outerPosition[6])}
            {renderCell('out-5', gameState.outerPosition[5])}
            {renderCell('out-4', gameState.outerPosition[4])}
            {renderCell('out-3', gameState.outerPosition[3])}
          </div>
          
          {/* Yellow Private Area */}
          <div style={{ width: '160px', height: '160px' }}>
            {renderPrivateArea('yellow')}
          </div>
        </div>
      </div>

      {/* Dashboard - Exact style from original */}
      <div className={cn(
        "w-full max-w-md h-16 rounded-lg border-4 border-white flex items-center justify-around text-white text-xl font-bold relative",
        currentPlayer === 'blue' && "bg-blue-500",
        currentPlayer === 'red' && "bg-red-500",
        currentPlayer === 'green' && "bg-green-500",
        currentPlayer === 'yellow' && "bg-yellow-500"
      )}>
        <span>{currentPlayer.toUpperCase()}'s turn</span>
        
        {/* Dice Section - Positioned like original */}
        <div 
          className={cn(
            "absolute -top-6 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full border-4 border-white flex items-center justify-center cursor-pointer transition-all",
            currentPlayer === 'blue' && "bg-blue-500",
            currentPlayer === 'red' && "bg-red-500",
            currentPlayer === 'green' && "bg-green-500",
            currentPlayer === 'yellow' && "bg-yellow-500",
            canRoll && "hover:scale-110",
            !canRoll && "opacity-50 cursor-not-allowed",
            isRolling && "animate-spin"
          )}
          onClick={canRoll ? onDiceRoll : undefined}
        >
          <DiceIcon className="w-12 h-12 text-white" />
        </div>
        
        <span>{diceValue}</span>
      </div>
    </div>
  );
}
