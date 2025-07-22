
import React from 'react';
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
  outerPosition: Record<string, Pawn[]>;
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
  className?: string;
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
  isAIThinking = false,
  className
}: LudoBoardV2Props) {

  const renderPawn = (pawn: Pawn, isHighlighted: boolean = false) => {
    console.log(`🎨 Rendering pawn: ${pawn.name}, highlighted: ${isHighlighted}, area: ${pawn.area}, cell: ${pawn.currentCell}`);
    return (
      <div
        key={pawn.name}
        className={cn(
          "pawn absolute w-full h-full flex items-center justify-center rounded-full z-[99] cursor-pointer",
          pawn.name,
          isHighlighted && "highlight"
        )}
        onClick={(e) => {
          e.stopPropagation();
          console.log('🖱️ Pawn clicked:', pawn.name, 'Highlighted:', isHighlighted);
          onPawnClick(pawn);
        }}
      >
        <img 
          src={`/lovable-uploads/pawn-${pawn.color}.png`} 
          alt={pawn.name}
          className="w-[90%]"
        />
      </div>
    );
  };

  const getCellPawns = (cellId: string): Pawn[] => {
    console.log(`🔍 === GETTING PAWNS FOR CELL: ${cellId} ===`);
    
    // Handle outer positions (out-1 to out-52) - EXACT MATCH REQUIRED
    if (cellId.startsWith('out-')) {
      const pawns = gameState.outerPosition[cellId] || [];
      if (pawns.length > 0) {
        console.log(`📍 Found ${pawns.length} pawns in ${cellId}:`, pawns.map(p => `${p.name}(current:${p.currentCell})`));
        // CRITICAL: Verify exact cell ID match
        const validPawns = pawns.filter(p => p.currentCell === cellId);
        if (validPawns.length !== pawns.length) {
          console.warn(`⚠️ Cell ID mismatch in ${cellId}! Expected ${pawns.length} pawns, found ${validPawns.length} with matching currentCell`);
        }
        return validPawns;
      }
      return [];
    }
    
    // Handle private areas - match the cell pattern exactly
    if (cellId.includes('private')) {
      const color = cellId.split('-')[0] as PlayerColor;
      const pawns = gameState.privateAreas[color] || [];
      if (pawns.length > 0) {
        console.log(`🏠 Found ${pawns.length} pawns in ${color} private area:`, pawns.map(p => `${p.name}(${p.currentCell})`));
      }
      // For private areas, show all pawns since they're displayed in a grid
      return pawns;
    }
    
    // Handle last lines
    if (cellId.includes('last-line')) {
      const [color, , , pos] = cellId.split('-');
      const pawns = gameState.lastLine[color as PlayerColor]?.[parseInt(pos)] || [];
      if (pawns.length > 0) {
        console.log(`🏁 Found ${pawns.length} pawns in ${color} last line pos ${pos}:`, pawns.map(p => p.name));
      }
      return pawns;
    }
    
    // Handle home areas
    if (cellId.includes('home')) {
      const color = cellId.split('-')[0] as PlayerColor;
      const pawns = gameState.homeAreas[color] || [];
      if (pawns.length > 0) {
        console.log(`🏆 Found ${pawns.length} pawns in ${color} home:`, pawns.map(p => p.name));
      }
      return pawns;
    }
    
    return [];
  };

  const renderCell = (cellId: string, additionalClasses: string = '') => {
    const pawns = getCellPawns(cellId);
    const isSafe = cellId.startsWith('out-') && SAFE_POSITIONS.includes(parseInt(cellId.replace('out-', '')));
    
    return (
      <div className={cn("cell flex-shrink-0 border border-[rgb(216,216,216)] relative", cellId, additionalClasses, isSafe && "star")}>
        {pawns.map((pawn, index) => (
          <div 
            key={pawn.name}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) translate(${(index % 2) * 6 - 3}px, ${Math.floor(index / 2) * 6 - 3}px)`
            }}
          >
            {renderPawn(pawn, highlightedPawns.has(pawn.name))}
          </div>
        ))}
      </div>
    );
  };

  const renderPrivateArea = (color: PlayerColor) => {
    const pawns = gameState.privateAreas[color] || [];
    console.log(`🏠 Rendering private area for ${color}:`, pawns.map(p => `${p.name}(${p.currentCell})`));
    
    return (
      <div className={cn("private flex-shrink-0 flex items-center justify-center", color)}>
        <div className="cells bg-white flex items-center justify-center grid grid-cols-2 gap-1 p-1">
          {[1, 2, 3, 4].map(id => {
            const pawn = pawns.find(p => p.id === id);
            return (
              <div key={id} className="cell relative rounded-full border border-gray-300 flex items-center justify-center">
                {pawn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {renderPawn(pawn, highlightedPawns.has(pawn.name))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHomeArea = () => {
    return (
      <div className="homes relative overflow-hidden">
        {/* Green home (top) */}
        <div className="home green absolute top-0 left-1/2 transform -translate-x-1/2">
          <div className="cells flex flex-row">
            {[1, 2, 3, 4].map(id => {
              const pawns = gameState.homeAreas.green || [];
              const pawn = pawns[id - 1];
              return (
                <div key={id} className="cell border-none w-[12px] h-[12px]">
                  {pawn && (
                    <div className="pawn transform scale-[1.1]">
                      <img src={`/lovable-uploads/pawn-${pawn.color}.png`} alt={pawn.name} className="w-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Red home (left) */}
        <div className="home red absolute left-0 top-1/2 transform -translate-y-1/2">
          <div className="cells flex flex-col">
            {[1, 2, 3, 4].map(id => {
              const pawns = gameState.homeAreas.red || [];
              const pawn = pawns[id - 1];
              return (
                <div key={id} className="cell border-none w-[12px] h-[12px]">
                  {pawn && (
                    <div className="pawn transform scale-[1.1]">
                      <img src={`/lovable-uploads/pawn-${pawn.color}.png`} alt={pawn.name} className="w-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Blue home (bottom) */}
        <div className="home blue absolute bottom-0 left-1/2 transform -translate-x-1/2">
          <div className="cells flex flex-row">
            {[1, 2, 3, 4].map(id => {
              const pawns = gameState.homeAreas.blue || [];
              const pawn = pawns[id - 1];
              return (
                <div key={id} className="cell border-none w-[12px] h-[12px]">
                  {pawn && (
                    <div className="pawn transform scale-[1.1]">
                      <img src={`/lovable-uploads/pawn-${pawn.color}.png`} alt={pawn.name} className="w-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Yellow home (right) */}
        <div className="home yellow absolute right-0 top-1/2 transform -translate-y-1/2">
          <div className="cells flex flex-col">
            {[1, 2, 3, 4].map(id => {
              const pawns = gameState.homeAreas.yellow || [];
              const pawn = pawns[id - 1];
              return (
                <div key={id} className="cell border-none w-[12px] h-[12px]">
                  {pawn && (
                    <div className="pawn transform scale-[1.1]">
                      <img src={`/lovable-uploads/pawn-${pawn.color}.png`} alt={pawn.name} className="w-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("text-white", className)}>
      <style>{`
        .board {
          --board-width: 280px;
          --cell-width: calc(var(--board-width) / 15);
          --board-bg: white;
          --red: red;
          --green: #07c107;
          --yellow: rgb(255, 209, 0);
          --blue: #2311db;
          --cell-border-color: rgb(216, 216, 216);
          
          width: var(--board-width);
          height: var(--board-width);
          margin: auto;
          background: var(--board-bg);
          border-radius: 8px;
          outline: 3px solid white;
        }
        
        .board .red { background-color: var(--red); }
        .board .green { background-color: var(--green); }
        .board .blue { background-color: var(--blue); }
        .board .yellow { background-color: var(--yellow); }
        
        .section { display: flex; }
        
        .private {
          width: calc(var(--cell-width) * 6);
          height: calc(var(--cell-width) * 6);
        }
        
        .private .cells {
          width: calc(var(--cell-width) * 4);
          height: calc(var(--cell-width) * 4);
        }
        
        .private .cells .cell {
          width: calc(var(--cell-width) * 1);
          height: calc(var(--cell-width) * 1);
          margin-left: 6px;
          margin-right: 6px;
        }
        
        .cells { display: flex; flex-wrap: wrap; }
        
        .cells .cell {
          width: var(--cell-width);
          height: var(--cell-width);
        }
        
        .cell.star {
          background-image: url('/lovable-uploads/star.png');
          background-size: 70%;
          background-repeat: no-repeat;
          background-position: center;
        }
        
        .homes {
          width: calc(var(--cell-width) * 3);
          height: calc(var(--cell-width) * 3);
          flex-shrink: 0;
        }
        
        .home {
          width: 30px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .home.green, .home.blue {
          height: 30px;
          width: 50px;
        }
        
        .pawn.highlight {
          box-shadow: 0px 0px 8px 2px rgb(255, 213, 0);
          border: 3px dashed rgb(0, 0, 0);
          animation: highlightPawn 0.5s infinite alternate-reverse;
        }
        
        @keyframes highlightPawn {
          to { transform: scale(1.15); }
        }
        
        .dashboard {
          width: 100%;
          height: 40px;
          margin-top: 15px;
          border-radius: 8px;
          border: 3px solid white;
          display: flex;
          justify-content: space-around;
          align-items: center;
          font-size: 16px;
          color: white;
          position: relative;
        }
        
        .dashboard.blue { background-color: var(--blue); }
        .dashboard.red { background-color: var(--red); }
        .dashboard.green { background-color: var(--green); }
        .dashboard.yellow { background-color: var(--yellow); }
        
        .dice-section {
          width: 50px;
          height: 50px;
          border-radius: 15px;
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .dice-section.blue { background-color: var(--blue); }
        .dice-section.red { background-color: var(--red); }
        .dice-section.green { background-color: var(--green); }
        .dice-section.yellow { background-color: var(--yellow); }
        
        .dice-section.highlight::before {
          content: '';
          display: block;
          width: 40px;
          height: 40px;
          border: 3px dashed rgb(0, 0, 0);
          position: absolute;
          top: 0;
          left: 0;
          border-radius: 40px;
          animation: highlightDice 0.5s ease-out infinite alternate-reverse;
        }
        
        .dice {
          width: 75%;
          height: 75%;
          background-image: url('/lovable-uploads/diceValues.png');
          background-size: cover;
        }
        
        .dice.face-1 { background-position-x: 0%; }
        .dice.face-2 { background-position-x: 20%; }
        .dice.face-3 { background-position-x: 40%; }
        .dice.face-4 { background-position-x: 60%; }
        .dice.face-5 { background-position-x: 80%; }
        .dice.face-6 { background-position-x: 100%; }
        
        .dice.rolling {
          animation: diceRoll 1.2s ease-out;
        }
        
        @keyframes diceRoll {
          to {
            background-image: url('/lovable-uploads/diceRoll.png');
            transform: rotateZ(calc(360deg * 4));
            filter: blur(1px);
          }
        }
        
        @keyframes highlightDice {
          to {
            transform: scale(1.15);
            box-shadow: 0px 0px 20px 4px rgb(255, 213, 0);
          }
        }
      `}</style>

      <div className="board">
        {/* Section 1 - Top */}
        <div className="section section-1">
          {/* Red Private Area */}
          {renderPrivateArea('red')}

          {/* Top Track - 6x3 grid */}
          <div className="cells">
            {renderCell('out-24')}
            {renderCell('out-25')}
            {renderCell('out-26')}
            
            {renderCell('out-23')}
            {renderCell('green-last-line-1', 'green')}
            {renderCell('out-27', 'green')}
            
            {renderCell('out-22', 'star')}
            {renderCell('green-last-line-2', 'green')}
            {renderCell('out-28')}
            
            {renderCell('out-21')}
            {renderCell('green-last-line-3', 'green')}
            {renderCell('out-29')}
            
            {renderCell('out-20')}
            {renderCell('green-last-line-4', 'green')}
            {renderCell('out-30')}
            
            {renderCell('out-19')}
            {renderCell('green-last-line-5', 'green')}
            {renderCell('out-31')}
          </div>

          {/* Green Private Area */}
          {renderPrivateArea('green')}
        </div>

        {/* Section 2 - Middle */}
        <div className="section section-2">
          {/* Left Track */}
          <div className="cells">
            {renderCell('out-13')}
            {renderCell('out-14', 'red')}
            {renderCell('out-15')}
            {renderCell('out-16')}
            {renderCell('out-17')}
            {renderCell('out-18')}

            {renderCell('out-12')}
            {renderCell('red-last-line-1', 'red')}
            {renderCell('red-last-line-2', 'red')}
            {renderCell('red-last-line-3', 'red')}
            {renderCell('red-last-line-4', 'red')}
            {renderCell('red-last-line-5', 'red')}

            {renderCell('out-11')}
            {renderCell('out-10')}
            {renderCell('out-9', 'star')}
            {renderCell('out-8')}
            {renderCell('out-7')}
            {renderCell('out-6')}
          </div>

          {/* Center Home Area */}
          {renderHomeArea()}

          {/* Right Track */}
          <div className="cells">
            {renderCell('out-32')}
            {renderCell('out-33')}
            {renderCell('out-34')}
            {renderCell('out-35', 'star')}
            {renderCell('out-36')}
            {renderCell('out-37')}

            {renderCell('yellow-last-line-5', 'yellow')}
            {renderCell('yellow-last-line-4', 'yellow')}
            {renderCell('yellow-last-line-3', 'yellow')}
            {renderCell('yellow-last-line-2', 'yellow')}
            {renderCell('yellow-last-line-1', 'yellow')}
            {renderCell('out-38')}

            {renderCell('out-44')}
            {renderCell('out-43')}
            {renderCell('out-42')}
            {renderCell('out-41')}
            {renderCell('out-40', 'yellow')}
            {renderCell('out-39')}
          </div>
        </div>

        {/* Section 3 - Bottom */}
        <div className="section section-3">
          {/* Blue Private Area */}
          {renderPrivateArea('blue')}

          {/* Bottom Track - 6x3 grid */}
          <div className="cells">
            {renderCell('out-5')}
            {renderCell('blue-last-line-5', 'blue')}
            {renderCell('out-45')}

            {renderCell('out-4')}
            {renderCell('blue-last-line-4', 'blue')}
            {renderCell('out-46')}

            {renderCell('out-3')}
            {renderCell('blue-last-line-3', 'blue')}
            {renderCell('out-47')}

            {renderCell('out-2')}
            {renderCell('blue-last-line-2', 'blue')}
            {renderCell('out-48', 'star')}

            {renderCell('out-1', 'blue')}
            {renderCell('blue-last-line-1', 'blue')}
            {renderCell('out-49')}

            {renderCell('out-52')}
            {renderCell('out-51')}
            {renderCell('out-50')}
          </div>

          {/* Yellow Private Area */}
          {renderPrivateArea('yellow')}
        </div>

        {/* Dashboard - REMOVED FROM BOARD, NOW HANDLED IN MAIN COMPONENT */}
        <div className={cn("dashboard", currentPlayer)}>
          <div className="player-name">
            <span>Roll the dice</span>
          </div>
          
          <div className={cn("dice-section", currentPlayer, canRoll && "highlight")} onClick={canRoll ? onDiceRoll : undefined}>
            <div className={cn("dice", `face-${diceValue}`, isRolling && "rolling")} />
          </div>
          
          <div className="dice-value">
            <span>{diceValue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
