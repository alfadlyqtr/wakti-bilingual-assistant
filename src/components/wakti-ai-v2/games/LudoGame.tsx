import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Home, Copy } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { LudoBoardV2 } from './LudoBoardV2';
import { PlayerSetup } from './PlayerSetup';
import { cn } from '@/lib/utils';

interface LudoGameProps {
  onBack: () => void;
}

type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';
type PlayerType = 'human' | 'ai';
type GameArea = 'private' | 'outer' | 'last-line' | 'home';

interface Pawn {
  id: number;
  name: string;
  color: PlayerColor;
  startCell: number;
  endCell: number;
  currentCell: string; // This will be like "blue-private-1" or "3" for outer positions
  area: GameArea;
}

interface GameState {
  privateAreas: Record<PlayerColor, Pawn[]>;
  outerPosition: Record<number, Pawn[]>; // CRITICAL: Store as numbers like original
  lastLine: Record<PlayerColor, Record<number, Pawn[]>>;
  homeAreas: Record<PlayerColor, Pawn[]>;
}

interface GameConfig {
  mode: '1v3' | '2v2' | '3v1' | '4human' | '1v1' | 'multiplayer';
  playerTypes: Record<PlayerColor, PlayerType>;
  turnOrder: PlayerColor[];
  playerNames: Record<string, string>;
}

const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];
const PAWN_NUMBER = 4;

// Starting positions matching original game - EXACT NUMBERS
const TRACK_START_POSITIONS = {
  blue: 1,
  red: 14,
  green: 27,
  yellow: 40
};

// End positions (where pawns enter last line) - EXACT NUMBERS
const TRACK_END_POSITIONS = {
  blue: 51,
  red: 12,
  green: 25,
  yellow: 38
};

export function LudoGame({ onBack }: LudoGameProps) {
  const { language } = useTheme();
  
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    privateAreas: { blue: [], red: [], green: [], yellow: [] },
    outerPosition: {},
    lastLine: { blue: {}, red: {}, green: {}, yellow: {} },
    homeAreas: { blue: [], red: [], green: [], yellow: [] }
  });
  
  const [diceValue, setDiceValue] = useState(6);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [highlightedPawns, setHighlightedPawns] = useState<Set<string>>(new Set());
  const [showSetup, setShowSetup] = useState(true);
  const [selectedMode, setSelectedMode] = useState<GameConfig['mode'] | null>(null);
  const [showPlayerSetup, setShowPlayerSetup] = useState(false);
  const [showMultiplayerJoin, setShowMultiplayerJoin] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [canRoll, setCanRoll] = useState(true);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // Initialize game state - MATCHING ORIGINAL STRUCTURE
  useEffect(() => {
    console.log('🎮 === INITIALIZING GAME STATE (ORIGINAL STRUCTURE) ===');
    const newGameState = { ...gameState };
    
    // Initialize outer positions with NUMBERS (1-52) like original
    for (let i = 1; i <= 52; i++) {
      newGameState.outerPosition[i] = [];
    }
    
    // Initialize last lines for each color
    for (const color of ['blue', 'red', 'green', 'yellow'] as PlayerColor[]) {
      newGameState.lastLine[color] = {};
      for (let i = 1; i <= 5; i++) {
        newGameState.lastLine[color][i] = [];
      }
    }
    
    console.log('✅ Game state structure initialized (ORIGINAL FORMAT)');
    setGameState(newGameState);
  }, []);

  const createPawn = (id: number, color: PlayerColor): Pawn => {
    const startPosition = TRACK_START_POSITIONS[color];
    const endPosition = TRACK_END_POSITIONS[color];

    const pawn = {
      id,
      name: `${color}-${id}`,
      color,
      startCell: startPosition, // STORE AS NUMBER like original
      endCell: endPosition,     // STORE AS NUMBER like original
      currentCell: `${color}-private-${id}`, // Private area format
      area: 'private' as GameArea
    };
    
    console.log(`🎯 Created pawn (ORIGINAL FORMAT): ${pawn.name}, currentCell: ${pawn.currentCell}, startCell: ${pawn.startCell}`);
    return pawn;
  };

  const initializeGame = useCallback((config: GameConfig) => {
    console.log('🎮 === INITIALIZING GAME (ORIGINAL STRUCTURE) ===');
    console.log('Config:', config);
    
    const newGameState: GameState = {
      privateAreas: { blue: [], red: [], green: [], yellow: [] },
      outerPosition: {},
      lastLine: { blue: {}, red: {}, green: {}, yellow: {} },
      homeAreas: { blue: [], red: [], green: [], yellow: [] }
    };
    
    // Initialize outer positions with NUMBERS like original
    for (let i = 1; i <= 52; i++) {
      newGameState.outerPosition[i] = [];
    }
    
    // Initialize last lines
    for (const color of ['blue', 'red', 'green', 'yellow'] as PlayerColor[]) {
      newGameState.lastLine[color] = {};
      for (let i = 1; i <= 5; i++) {
        newGameState.lastLine[color][i] = [];
      }
    }

    // Create pawns for active players
    config.turnOrder.forEach(color => {
      console.log(`🎯 Creating pawns for ${color}`);
      for (let i = 1; i <= PAWN_NUMBER; i++) {
        const pawn = createPawn(i, color);
        newGameState.privateAreas[color].push(pawn);
      }
      console.log(`📍 ${color} private area:`, newGameState.privateAreas[color].map(p => `${p.name}(${p.currentCell})`));
    });

    console.log('🎮 === FINAL INITIAL GAME STATE (ORIGINAL) ===');
    console.log('Private areas:', Object.fromEntries(
      Object.entries(newGameState.privateAreas).map(([color, pawns]) => [color, pawns.map(p => `${p.name}(${p.currentCell})`)])
    ));
    
    setGameState(newGameState);
    setGameConfig(config);
    setCurrentTurn(0);
    setGameStarted(true);
    setShowSetup(false);
    setShowPlayerSetup(false);
    setShowMultiplayerJoin(false);
    setWinner(null);
    setCanRoll(true);
    setIsAIThinking(false);
  }, []);

  const getAvailablePawns = (color: PlayerColor, dice: number): Pawn[] => {
    console.log(`🎯 === GETTING AVAILABLE PAWNS FOR ${color} WITH DICE ${dice} ===`);
    const availablePawns: Pawn[] = [];
    
    // Check pawns in private area if dice is 6
    if (dice === 6) {
      const privatePawns = gameState.privateAreas[color] || [];
      console.log(`🏠 Private pawns for ${color}:`, privatePawns.map(p => `${p.name}(${p.currentCell})`));
      availablePawns.push(...privatePawns);
    }
    
    // Check pawns in outer positions - USING NUMBERS like original
    for (const position in gameState.outerPosition) {
      const pos = parseInt(position);
      const pawnsInCell = gameState.outerPosition[pos] || [];
      pawnsInCell.forEach(pawn => {
        if (pawn.color === color) {
          console.log(`🔍 Found pawn ${pawn.name} in outer position ${pos}`);
          availablePawns.push(pawn);
        }
      });
    }
    
    // Check pawns in last line that can move
    for (const pos in gameState.lastLine[color]) {
      const pawnsInPos = gameState.lastLine[color][pos] || [];
      pawnsInPos.forEach(pawn => {
        const currentPos = parseInt(pawn.currentCell);
        if (currentPos + dice <= 6) {
          console.log(`🏁 Found pawn ${pawn.name} in last line pos ${pos}, can move`);
          availablePawns.push(pawn);
        }
      });
    }
    
    console.log(`✅ Total available pawns for ${color}:`, availablePawns.map(p => `${p.name}(${p.currentCell})`));
    return availablePawns;
  };

  const getNextPosition = (pawn: Pawn, dice: number) => {
    console.log(`🎯 === CALCULATING NEXT POSITION FOR ${pawn.name} (ORIGINAL LOGIC) ===`);
    console.log(`Current: ${pawn.currentCell}, Area: ${pawn.area}, Dice: ${dice}`);
    
    if (pawn.area === 'private') {
      const startPos = pawn.startCell; // Already a number
      console.log(`🚀 Moving from private to start position: ${startPos}`);
      return {
        cell: startPos,
        area: 'outer' as GameArea
      };
    }
    
    if (pawn.area === 'outer') {
      const currentPos = parseInt(pawn.currentCell);
      const endPos = pawn.endCell;
      const nextPos = currentPos + dice;
      
      console.log(`🛤️ Current outer pos: ${currentPos}, End pos: ${endPos}, Next pos: ${nextPos}`);
      
      // Check if entering last line (using original logic)
      if ((currentPos >= endPos - 6 && currentPos <= endPos) && nextPos > endPos) {
        const remaining = nextPos - endPos;
        console.log(`🏁 Entering last line, remaining steps: ${remaining}`);
        if (remaining === 6) {
          return {
            cell: 0,
            area: 'home' as GameArea
          };
        } else {
          return {
            cell: remaining,
            area: 'last-line' as GameArea
          };
        }
      }
      
      // Normal movement on outer track
      let finalPos = nextPos;
      if (finalPos > 52) {
        finalPos = finalPos - 52;
      }
      
      console.log(`➡️ Normal outer movement to: ${finalPos}`);
      return {
        cell: finalPos,
        area: 'outer' as GameArea
      };
    }
    
    if (pawn.area === 'last-line') {
      const currentPos = parseInt(pawn.currentCell);
      const nextPos = currentPos + dice;
      
      console.log(`🏁 Last line movement: ${currentPos} + ${dice} = ${nextPos}`);
      
      if (nextPos === 6) {
        return {
          cell: 0,
          area: 'home' as GameArea
        };
      } else if (nextPos < 6) {
        return {
          cell: nextPos,
          area: 'last-line' as GameArea
        };
      }
    }
    
    console.log('❌ Invalid move - returning null');
    return null;
  };

  const movePawn = (pawn: Pawn, dice: number) => {
    console.log(`🎯 === MOVING PAWN ${pawn.name} WITH DICE ${dice} (FIXED LOGIC) ===`);
    console.log(`Before move - Current: ${pawn.currentCell}, Area: ${pawn.area}`);
    
    // DEEP COPY of game state to prevent mutation issues
    const newGameState: GameState = {
      privateAreas: JSON.parse(JSON.stringify(gameState.privateAreas)),
      outerPosition: JSON.parse(JSON.stringify(gameState.outerPosition)),
      lastLine: JSON.parse(JSON.stringify(gameState.lastLine)),
      homeAreas: JSON.parse(JSON.stringify(gameState.homeAreas))
    };
    
    const nextPos = getNextPosition(pawn, dice);
    
    if (!nextPos) {
      console.log('❌ Invalid move - aborting');
      return;
    }
    
    console.log(`📍 Next position: ${nextPos.cell}, area: ${nextPos.area}`);
    
    // Find and clone the pawn to avoid reference issues
    let movingPawn: Pawn | null = null;
    
    // Remove pawn from current position with safety checks
    if (pawn.area === 'private') {
      const privateArray = newGameState.privateAreas[pawn.color];
      const index = privateArray.findIndex(p => p.id === pawn.id && p.color === pawn.color);
      if (index !== -1) {
        movingPawn = { ...privateArray[index] };
        privateArray.splice(index, 1);
        console.log(`🏠 Removed ${pawn.name} from private area (index ${index})`);
      } else {
        console.error(`❌ Pawn ${pawn.name} not found in private area!`);
        return;
      }
    } else if (pawn.area === 'outer') {
      const currentPos = parseInt(pawn.currentCell);
      if (newGameState.outerPosition[currentPos]) {
        const pawnsInCell = newGameState.outerPosition[currentPos];
        const index = pawnsInCell.findIndex(p => p.id === pawn.id && p.color === pawn.color);
        if (index !== -1) {
          movingPawn = { ...pawnsInCell[index] };
          pawnsInCell.splice(index, 1);
          console.log(`🛤️ Removed ${pawn.name} from outer position ${currentPos} (index ${index})`);
        } else {
          console.error(`❌ Pawn ${pawn.name} not found in outer position ${currentPos}!`);
          return;
        }
      }
    } else if (pawn.area === 'last-line') {
      const currentPos = parseInt(pawn.currentCell);
      if (newGameState.lastLine[pawn.color][currentPos]) {
        const pawnsInPos = newGameState.lastLine[pawn.color][currentPos];
        const index = pawnsInPos.findIndex(p => p.id === pawn.id && p.color === pawn.color);
        if (index !== -1) {
          movingPawn = { ...pawnsInPos[index] };
          pawnsInPos.splice(index, 1);
          console.log(`🏁 Removed ${pawn.name} from last line pos ${currentPos} (index ${index})`);
        } else {
          console.error(`❌ Pawn ${pawn.name} not found in last line position ${currentPos}!`);
          return;
        }
      }
    }
    
    if (!movingPawn) {
      console.error(`❌ Failed to find and remove pawn ${pawn.name}!`);
      return;
    }
    
    // Update pawn position
    movingPawn.currentCell = nextPos.cell.toString();
    movingPawn.area = nextPos.area;
    console.log(`✅ Updated ${movingPawn.name} to: ${movingPawn.currentCell}, area: ${movingPawn.area}`);
    
    // Place pawn in new position
    if (nextPos.area === 'outer') {
      const pos = nextPos.cell as number;
      // Initialize array if it doesn't exist
      if (!newGameState.outerPosition[pos]) {
        newGameState.outerPosition[pos] = [];
      }
      
      const existingPawns = [...newGameState.outerPosition[pos]]; // Clone array
      const enemyPawns = existingPawns.filter(p => p.color !== movingPawn.color);
      
      // Send enemy pawns back to private with deep cloning
      enemyPawns.forEach(enemyPawn => {
        console.log(`💥 Capturing ${enemyPawn.name}`);
        const capturedPawn = { ...enemyPawn };
        capturedPawn.area = 'private';
        capturedPawn.currentCell = `${capturedPawn.color}-private-${capturedPawn.id}`;
        newGameState.privateAreas[capturedPawn.color].push(capturedPawn);
      });
      
      // Keep only same color pawns and add current pawn
      const samePawns = existingPawns.filter(p => p.color === movingPawn.color);
      newGameState.outerPosition[pos] = [movingPawn, ...samePawns];
      console.log(`📍 Placed ${movingPawn.name} in outer position ${pos} with ${samePawns.length} allies`);
      
    } else if (nextPos.area === 'last-line') {
      const pos = nextPos.cell as number;
      if (!newGameState.lastLine[movingPawn.color][pos]) {
        newGameState.lastLine[movingPawn.color][pos] = [];
      }
      newGameState.lastLine[movingPawn.color][pos].push(movingPawn);
      console.log(`🏁 Placed ${movingPawn.name} in last line pos ${pos}`);
      
    } else if (nextPos.area === 'home') {
      newGameState.homeAreas[movingPawn.color].push(movingPawn);
      console.log(`🏆 ${movingPawn.name} reached home!`);
    }
    
    // Validate state before setting
    const totalPawns = Object.values(newGameState.privateAreas).flat().length +
      Object.values(newGameState.outerPosition).flat().length +
      Object.values(newGameState.lastLine).flatMap(color => Object.values(color).flat()).length +
      Object.values(newGameState.homeAreas).flat().length;
    
    console.log(`🎮 Total pawns after move: ${totalPawns} (should be ${gameConfig?.turnOrder.length * 4})`);
    
    console.log('🎮 === UPDATED GAME STATE (FIXED FORMAT) ===');
    console.log('Private areas:', Object.fromEntries(
      Object.entries(newGameState.privateAreas).map(([color, pawns]) => [color, pawns.map(p => `${p.name}(${p.currentCell})`)])
    ));
    console.log('Outer positions with pawns:', Object.fromEntries(
      Object.entries(newGameState.outerPosition)
        .filter(([k, v]) => v.length > 0)
        .map(([k, v]) => [k, v.map(p => `${p.name}(${p.currentCell})`)])
    ));
    
    setGameState(newGameState);
    setHighlightedPawns(new Set());
    
    // Check for win condition
    if (newGameState.homeAreas[movingPawn.color].length === 4) {
      setWinner(movingPawn.color);
      return;
    }
    
    nextTurn(dice);
  };

  const rollDice = useCallback(() => {
    if (isRolling || winner || !canRoll) return;
    
    console.log('🎲 === ROLLING DICE ===');
    setIsRolling(true);
    setCanRoll(false);
    setHighlightedPawns(new Set());
    
    setTimeout(() => {
      const newDiceValue = Math.floor(Math.random() * 6) + 1;
      console.log('🎲 Dice result:', newDiceValue);
      setDiceValue(newDiceValue);
      setIsRolling(false);
      
      const currentColor = gameConfig?.turnOrder[currentTurn];
      if (currentColor) {
        const availablePawns = getAvailablePawns(currentColor, newDiceValue);
        
        if (availablePawns.length === 0) {
          console.log('⏭️ No available moves - skipping turn');
          setTimeout(() => nextTurn(newDiceValue), 1000);
        } else {
          // Highlight available pawns
          const highlighted = new Set<string>();
          availablePawns.forEach(pawn => highlighted.add(pawn.name));
          setHighlightedPawns(highlighted);
          console.log('✨ Highlighted pawns:', Array.from(highlighted));
          
          // If current player is AI, make move automatically
          if (gameConfig?.playerTypes[currentColor] === 'ai') {
            setIsAIThinking(true);
            setTimeout(() => {
              const bestPawn = availablePawns[0]; // Simple AI - pick first available
              console.log(`🤖 AI moving pawn: ${bestPawn.name}`);
              movePawn(bestPawn, newDiceValue);
              setIsAIThinking(false);
            }, 1500);
          } else {
            setCanRoll(false); // Human must make a move first
            console.log('👤 Waiting for human player to select pawn');
          }
        }
      }
    }, 1200);
  }, [isRolling, currentTurn, gameConfig, gameState, winner, canRoll]);

  const nextTurn = (dice: number) => {
    console.log(`⏭️ === NEXT TURN (dice was ${dice}) ===`);
    if (dice !== 6) {
      setCurrentTurn(prev => (prev + 1) % (gameConfig?.turnOrder.length || 4));
    }
    setCanRoll(true);
  };

  const handlePawnClick = (pawn: Pawn) => {
    console.log(`🖱️ === PAWN CLICKED: ${pawn.name} ===`);
    console.log('Is highlighted:', highlightedPawns.has(pawn.name));
    console.log('Is AI:', gameConfig?.playerTypes[pawn.color] === 'ai');
    console.log('Winner:', winner);
    
    if (!highlightedPawns.has(pawn.name)) {
      console.log('❌ Pawn not highlighted - ignoring click');
      return;
    }
    if (gameConfig?.playerTypes[pawn.color] === 'ai') {
      console.log('❌ AI pawn - ignoring human click');
      return;
    }
    if (winner) {
      console.log('❌ Game over - ignoring click');
      return;
    }
    
    console.log('✅ Moving pawn via click');
    movePawn(pawn, diceValue);
  };

  // Auto-roll for AI players
  useEffect(() => {
    if (!gameStarted || !gameConfig || winner) return;
    
    const currentColor = gameConfig.turnOrder[currentTurn];
    const isAI = gameConfig.playerTypes[currentColor] === 'ai';
    
    if (isAI && canRoll && !isRolling) {
      const timer = setTimeout(() => {
        console.log(`🤖 Auto-rolling for AI player: ${currentColor}`);
        rollDice();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [gameStarted, gameConfig, currentTurn, canRoll, isRolling, winner, rollDice]);

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    return code;
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
    }
  };

  const handleModeSelect = (mode: GameConfig['mode']) => {
    setSelectedMode(mode);
    if (mode === 'multiplayer') {
      setShowMultiplayerJoin(true);
    } else {
      setShowPlayerSetup(true);
    }
  };

  const handlePlayerSetupComplete = (playerNames: Record<string, string>) => {
    if (!selectedMode) return;
    
    const config = createGameConfig(selectedMode, playerNames);
    initializeGame(config);
  };

  const handleCreateRoom = () => {
    const code = generateRoomCode();
    const config: GameConfig = {
      mode: 'multiplayer',
      playerTypes: { blue: 'human', red: 'human', green: 'human', yellow: 'human' },
      turnOrder: ['blue', 'red', 'green', 'yellow'],
      playerNames: { blue: 'Host', red: 'Player 2', green: 'Player 3', yellow: 'Player 4' }
    };
    initializeGame(config);
  };

  const handleJoinRoom = () => {
    if (!roomCode) return;
    const config: GameConfig = {
      mode: 'multiplayer',
      playerTypes: { blue: 'human', red: 'human', green: 'human', yellow: 'human' },
      turnOrder: ['blue', 'red', 'green', 'yellow'],
      playerNames: { blue: 'Player 1', red: 'Player 2', green: 'Player 3', yellow: 'Player 4' }
    };
    initializeGame(config);
  };

  const createGameConfig = (mode: GameConfig['mode'], playerNames: Record<string, string>): GameConfig => {
    const configs: Record<Exclude<GameConfig['mode'], 'multiplayer'>, Omit<GameConfig, 'playerNames' | 'mode'>> = {
      '1v3': {
        playerTypes: { blue: 'human', red: 'ai', green: 'ai', yellow: 'ai' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '2v2': {
        playerTypes: { blue: 'human', red: 'ai', green: 'human', yellow: 'ai' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '3v1': {
        playerTypes: { blue: 'human', red: 'human', green: 'human', yellow: 'ai' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '4human': {
        playerTypes: { blue: 'human', red: 'human', green: 'human', yellow: 'human' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '1v1': {
        playerTypes: { blue: 'human', red: 'human', green: 'ai', yellow: 'ai' },
        turnOrder: ['blue', 'red']
      }
    };

    return { mode, ...configs[mode], playerNames };
  };

  const handlePlayAgain = () => {
    setWinner(null);
    setShowSetup(true);
    setShowPlayerSetup(false);
    setShowMultiplayerJoin(false);
    setSelectedMode(null);
    setGameStarted(false);
    setIsAIThinking(false);
  };

  const handleBackToModeSelection = () => {
    setShowPlayerSetup(false);
    setShowMultiplayerJoin(false);
    setSelectedMode(null);
  };

  if (showMultiplayerJoin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4 text-center text-white">
        <h1 className="text-center mt-4 mb-6 text-4xl font-bold">Ludo Game</h1>
        
        <div className="max-w-md mx-auto space-y-6">
          <h2 className="text-2xl font-bold mb-4">
            {language === 'ar' ? 'لعب متعدد الأشخاص' : 'Multiplayer Game'}
          </h2>
          
          <div className="space-y-4">
            <Button onClick={handleCreateRoom} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700">
              {language === 'ar' ? 'إنشاء غرفة لعب' : 'Create Room'}
            </Button>
            
            <div className="text-center text-lg">
              {language === 'ar' ? 'أو' : 'OR'}
            </div>
            
            <div className="space-y-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder={language === 'ar' ? 'ادخل كود الغرفة' : 'Enter Room Code'}
                className="text-center text-lg font-mono h-12 bg-white/90"
                maxLength={6}
              />
              <Button 
                onClick={handleJoinRoom} 
                disabled={!roomCode}
                className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
              >
                {language === 'ar' ? 'انضمام للغرفة' : 'Join Room'}
              </Button>
            </div>
          </div>
          
          <Button variant="outline" onClick={handleBackToModeSelection} className="w-full bg-white/20 border-white text-white">
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
        </div>
      </div>
    );
  }

  if (showPlayerSetup && selectedMode && selectedMode !== 'multiplayer') {
    return (
      <PlayerSetup
        gameMode={selectedMode}
        onSetupComplete={handlePlayerSetupComplete}
        onBack={handleBackToModeSelection}
      />
    );
  }

  if (showSetup) {
    const modes = [
      { id: '1v3', name: language === 'ar' ? 'أنا ضد 3 ذكاء اصطناعي' : '1 Human vs 3 AI' },
      { id: '2v2', name: language === 'ar' ? '2 بشر ضد 2 ذكاء اصطناعي' : '2 Humans vs 2 AI' },
      { id: '3v1', name: language === 'ar' ? '3 بشر ضد 1 ذكاء اصطناعي' : '3 Humans vs 1 AI' },
      { id: '4human', name: language === 'ar' ? '4 بشر' : '4 Humans' },
      { id: '1v1', name: language === 'ar' ? '1 ضد 1' : '1 vs 1' },
      { id: 'multiplayer', name: language === 'ar' ? 'لعب متعدد الأشخاص' : 'Online Multiplayer' }
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4 text-center text-white">
        <h1 className="text-center mt-4 mb-6 text-4xl font-bold">Ludo Game</h1>
        
        <div className="flex items-center justify-between mb-6 max-w-md mx-auto">
          <Button onClick={onBack} variant="outline" className="bg-white/20 border-white text-white">
            <Home className="w-4 h-4 mr-2" />    
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
          
          <h2 className="text-xl font-bold">
            {language === 'ar' ? 'اختر نمط اللعبة' : 'Choose Game Mode'}
          </h2>
        </div>
        
        <div className="space-y-3 max-w-md mx-auto">
          {modes.map(mode => (
            <Button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id as GameConfig['mode'])}
              className="w-full h-12 text-base flex items-center justify-center space-x-2 bg-white/20 border-white text-white hover:bg-white/30"
              variant="outline"
            >
              {mode.id === 'multiplayer' && <Users className="w-4 h-4" />}
              <span>{mode.name}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (!gameStarted || !gameConfig) {
    return null;
  }

  const currentColor = gameConfig.turnOrder[currentTurn];
  const isCurrentPlayerAI = gameConfig.playerTypes[currentColor] === 'ai';
  const currentPlayerName = gameConfig.playerNames[currentColor] || currentColor;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-2 text-white">
      <h1 className="text-center mt-2 mb-4 text-3xl font-bold">Ludo Game</h1>
      
      {/* Header */}
      <div className="w-full max-w-sm mx-auto flex justify-between items-center mb-2">
        <Button onClick={onBack} variant="outline" size="sm" className="bg-white/20 border-white text-white text-xs px-2 py-1">
          <Home className="w-3 h-3 mr-1" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        
        {roomCode && (
          <div className="flex items-center space-x-1 bg-white/20 rounded px-2 py-1">
            <span className="text-xs">{roomCode}</span>
            <Button variant="ghost" size="sm" onClick={copyRoomCode} className="h-auto p-0">
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Winner Banner */}
      {winner && (
        <div className="w-full max-w-sm mx-auto p-3 bg-green-100 border border-green-300 rounded-lg text-center mb-2">
          <p className="text-sm font-bold text-green-800">
            🏆 {gameConfig.playerNames[winner] || winner} {language === 'ar' ? 'فاز!' : 'Wins!'}
          </p>
          <Button onClick={handlePlayAgain} className="mt-1" size="sm">
            {language === 'ar' ? 'العب مرة أخرى' : 'Play Again'}
          </Button>
        </div>
      )}

      {/* Game Board */}
      <LudoBoardV2
        gameState={gameState}
        highlightedPawns={highlightedPawns}
        onPawnClick={handlePawnClick}
        currentPlayer={currentColor}
        diceValue={diceValue}
        onDiceRoll={rollDice}
        isRolling={isRolling}
        canRoll={canRoll && !isCurrentPlayerAI}
        isAIThinking={isAIThinking}
        className="mb-3"
      />

      {/* Player Status */}
      <div className="w-full max-w-sm mx-auto grid grid-cols-2 gap-1 text-xs">
        {gameConfig.turnOrder.map(color => (
          <div key={color} className={cn(
            "flex flex-col items-center p-2 rounded border bg-white/20 text-white",
            color === currentColor && 'border-yellow-400 bg-yellow-500/30'
          )}>
            <div className={cn(
              "w-4 h-4 rounded-full mb-1",
              color === 'blue' && "bg-blue-500",
              color === 'red' && "bg-red-500", 
              color === 'green' && "bg-green-500",
              color === 'yellow' && "bg-yellow-500"
            )} />
            <span className={cn(
              "font-bold text-[11px] text-center",
              color === currentColor && 'text-yellow-200'
            )}>
              {gameConfig.playerNames[color] || color}
              {gameConfig.playerTypes[color] === 'ai' && ' (AI)'}
            </span>
            <div className="text-[9px] text-gray-300 space-y-0.5">
              <div>{language === 'ar' ? 'منزل' : 'Home'}: {gameState.homeAreas[color].length}/4</div>
              <div>{language === 'ar' ? 'خاص' : 'Private'}: {gameState.privateAreas[color].length}/4</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
