
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Volume2, VolumeX, Users, Home, Copy } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { LudoBoardV2 } from './LudoBoardV2';
import { PlayerSetup } from './PlayerSetup';
import { waktiSounds } from '@/services/waktiSounds';
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

interface GameConfig {
  mode: '1v3' | '2v2' | '3v1' | '4human' | '1v1' | 'multiplayer';
  playerTypes: Record<PlayerColor, PlayerType>;
  turnOrder: PlayerColor[];
  playerNames: Record<string, string>;
}

const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];
const PAWN_NUMBER = 4;

// Starting positions matching original game
const TRACK_START_POSITIONS = {
  blue: 1,
  red: 14,
  green: 27,
  yellow: 40
};

// End positions (where pawns enter last line)
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSetup, setShowSetup] = useState(true);
  const [selectedMode, setSelectedMode] = useState<GameConfig['mode'] | null>(null);
  const [showPlayerSetup, setShowPlayerSetup] = useState(false);
  const [showMultiplayerJoin, setShowMultiplayerJoin] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [canRoll, setCanRoll] = useState(true);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // Initialize game state
  useEffect(() => {
    const newGameState = { ...gameState };
    
    // Initialize outer positions (1-52)
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
    
    setGameState(newGameState);
  }, []);

  const createPawn = (id: number, color: PlayerColor): Pawn => {
    const startPosition = TRACK_START_POSITIONS[color];
    const endPosition = TRACK_END_POSITIONS[color];

    return {
      id,
      name: `${color}-${id}`,
      color,
      startCell: startPosition.toString(),
      endCell: endPosition.toString(),
      currentCell: `${color}-private-${id}`,
      area: 'private'
    };
  };

  const initializeGame = useCallback((config: GameConfig) => {
    console.log('Initializing game with config:', config);
    const newGameState: GameState = {
      privateAreas: { blue: [], red: [], green: [], yellow: [] },
      outerPosition: {},
      lastLine: { blue: {}, red: {}, green: {}, yellow: {} },
      homeAreas: { blue: [], red: [], green: [], yellow: [] }
    };
    
    // Initialize outer positions
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
      for (let i = 1; i <= PAWN_NUMBER; i++) {
        const pawn = createPawn(i, color);
        newGameState.privateAreas[color].push(pawn);
      }
    });

    console.log('Initial game state:', newGameState);
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

  const playSound = async (soundType: 'chime' | 'beep' | 'ding') => {
    if (soundEnabled) {
      await waktiSounds.playNotificationSound(soundType);
    }
  };

  const getAvailablePawns = (color: PlayerColor, dice: number): Pawn[] => {
    const availablePawns: Pawn[] = [];
    
    // Check pawns in private area if dice is 6
    if (dice === 6) {
      availablePawns.push(...gameState.privateAreas[color]);
    }
    
    // Check pawns in outer positions
    for (const pos in gameState.outerPosition) {
      gameState.outerPosition[pos].forEach(pawn => {
        if (pawn.color === color) {
          availablePawns.push(pawn);
        }
      });
    }
    
    // Check pawns in last line that can move
    for (const pos in gameState.lastLine[color]) {
      if (gameState.lastLine[color][pos]) {
        gameState.lastLine[color][pos].forEach(pawn => {
          const currentPos = parseInt(pawn.currentCell);
          if (currentPos + dice <= 6) {
            availablePawns.push(pawn);
          }
        });
      }
    }
    
    console.log(`Available pawns for ${color} with dice ${dice}:`, availablePawns);
    return availablePawns;
  };

  const getNextPosition = (pawn: Pawn, dice: number) => {
    if (pawn.area === 'private') {
      return {
        cell: TRACK_START_POSITIONS[pawn.color],
        area: 'outer' as GameArea
      };
    }
    
    if (pawn.area === 'outer') {
      const currentPos = parseInt(pawn.currentCell);
      const endPos = TRACK_END_POSITIONS[pawn.color];
      const nextPos = currentPos + dice;
      
      // Check if entering last line
      if (currentPos <= endPos && nextPos > endPos) {
        const remaining = nextPos - endPos;
        if (remaining <= 5) {
          return {
            cell: remaining,
            area: 'last-line' as GameArea
          };
        } else if (remaining === 6) {
          return {
            cell: 0,
            area: 'home' as GameArea
          };
        }
      }
      
      // Normal movement on outer track
      let finalPos = nextPos;
      if (finalPos > 52) {
        finalPos = finalPos - 52;
      }
      
      return {
        cell: finalPos,
        area: 'outer' as GameArea
      };
    }
    
    if (pawn.area === 'last-line') {
      const currentPos = parseInt(pawn.currentCell);
      const nextPos = currentPos + dice;
      
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
    
    return null;
  };

  const movePawn = (pawn: Pawn, dice: number) => {
    console.log(`Moving pawn ${pawn.name} with dice ${dice}`);
    const newGameState = { ...gameState };
    const nextPos = getNextPosition(pawn, dice);
    
    if (!nextPos) {
      console.log('Invalid move');
      return;
    }
    
    // Remove pawn from current position
    if (pawn.area === 'private') {
      const index = newGameState.privateAreas[pawn.color].findIndex(p => p.name === pawn.name);
      if (index !== -1) {
        newGameState.privateAreas[pawn.color].splice(index, 1);
      }
    } else if (pawn.area === 'outer') {
      const currentPos = parseInt(pawn.currentCell);
      const index = newGameState.outerPosition[currentPos]?.findIndex(p => p.name === pawn.name);
      if (index !== -1) {
        newGameState.outerPosition[currentPos].splice(index, 1);
      }
    } else if (pawn.area === 'last-line') {
      const currentPos = parseInt(pawn.currentCell);
      const index = newGameState.lastLine[pawn.color][currentPos]?.findIndex(p => p.name === pawn.name);
      if (index !== -1) {
        newGameState.lastLine[pawn.color][currentPos].splice(index, 1);
      }
    }
    
    // Update pawn position
    pawn.currentCell = nextPos.cell.toString();
    pawn.area = nextPos.area;
    
    // Place pawn in new position
    if (nextPos.area === 'outer') {
      // Handle captures
      const existingPawns = newGameState.outerPosition[nextPos.cell] || [];
      const enemyPawns = existingPawns.filter(p => p.color !== pawn.color);
      
      // Send enemy pawns back to private
      enemyPawns.forEach(enemyPawn => {
        enemyPawn.area = 'private';
        enemyPawn.currentCell = `${enemyPawn.color}-private-${enemyPawn.id}`;
        newGameState.privateAreas[enemyPawn.color].push(enemyPawn);
      });
      
      newGameState.outerPosition[nextPos.cell] = [pawn, ...existingPawns.filter(p => p.color === pawn.color)];
    } else if (nextPos.area === 'last-line') {
      if (!newGameState.lastLine[pawn.color][nextPos.cell]) {
        newGameState.lastLine[pawn.color][nextPos.cell] = [];
      }
      newGameState.lastLine[pawn.color][nextPos.cell].push(pawn);
    } else if (nextPos.area === 'home') {
      newGameState.homeAreas[pawn.color].push(pawn);
      playSound('ding');
    }
    
    console.log('New game state after move:', newGameState);
    setGameState(newGameState);
    setHighlightedPawns(new Set());
    playSound('beep');
    
    // Check for win condition
    if (newGameState.homeAreas[pawn.color].length === 4) {
      setWinner(pawn.color);
      return;
    }
    
    nextTurn(dice);
  };

  const rollDice = useCallback(() => {
    if (isRolling || winner || !canRoll) return;
    
    console.log('Rolling dice for current player');
    setIsRolling(true);
    setCanRoll(false);
    setHighlightedPawns(new Set());
    playSound('chime');
    
    setTimeout(() => {
      const newDiceValue = Math.floor(Math.random() * 6) + 1;
      console.log('Dice rolled:', newDiceValue);
      setDiceValue(newDiceValue);
      setIsRolling(false);
      
      const currentColor = gameConfig?.turnOrder[currentTurn];
      if (currentColor) {
        const availablePawns = getAvailablePawns(currentColor, newDiceValue);
        
        if (availablePawns.length === 0) {
          console.log('No available moves');
          setTimeout(() => nextTurn(newDiceValue), 1000);
        } else {
          // Highlight available pawns
          const highlighted = new Set<string>();
          availablePawns.forEach(pawn => highlighted.add(pawn.name));
          setHighlightedPawns(highlighted);
          
          // If current player is AI, make move automatically
          if (gameConfig?.playerTypes[currentColor] === 'ai') {
            setIsAIThinking(true);
            setTimeout(() => {
              const bestPawn = availablePawns[0]; // Simple AI - pick first available
              movePawn(bestPawn, newDiceValue);
              setIsAIThinking(false);
            }, 1500);
          } else {
            setCanRoll(false); // Human must make a move first
          }
        }
      }
    }, 1200);
  }, [isRolling, currentTurn, gameConfig, gameState, winner, canRoll]);

  const nextTurn = (dice: number) => {
    if (dice !== 6) {
      setCurrentTurn(prev => (prev + 1) % (gameConfig?.turnOrder.length || 4));
    }
    setCanRoll(true);
  };

  const handlePawnClick = (pawn: Pawn) => {
    console.log('Pawn clicked:', pawn.name, 'Is highlighted:', highlightedPawns.has(pawn.name));
    if (!highlightedPawns.has(pawn.name)) return;
    if (gameConfig?.playerTypes[pawn.color] === 'ai') return;
    if (winner) return;
    
    movePawn(pawn, diceValue);
  };

  // Auto-roll for AI players
  useEffect(() => {
    if (!gameStarted || !gameConfig || winner) return;
    
    const currentColor = gameConfig.turnOrder[currentTurn];
    const isAI = gameConfig.playerTypes[currentColor] === 'ai';
    
    if (isAI && canRoll && !isRolling) {
      const timer = setTimeout(() => {
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
      <div 
        className="min-h-screen p-4 text-center text-white font-['Bangers',cursive]"
        style={{ 
          backgroundColor: 'rgb(206, 206, 206)',
          backgroundImage: 'url(/lovable-uploads/bg.jpg)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover'
        }}
      >
        <h1 className="text-center mt-4 mb-6 tracking-[10px] text-4xl">Ludo MG</h1>
        
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
      <div 
        className="min-h-screen p-4 text-center text-white font-['Bangers',cursive]"
        style={{ 
          backgroundColor: 'rgb(206, 206, 206)',
          backgroundImage: 'url(/lovable-uploads/bg.jpg)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover'
        }}
      >
        <h1 className="text-center mt-4 mb-6 tracking-[10px] text-4xl">Ludo MG</h1>
        
        <div className="flex items-center justify-between mb-6 max-w-md mx-auto">
          <Button onClick={onBack} variant="outline" className="bg-white/20 border-white text-white">
            <Home className="w-4 h-4 mr-2" />    
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
          
          <h2 className="text-xl font-bold">
            {language === 'ar' ? 'اختر نمط اللعبة' : 'Choose Game Mode'}
          </h2>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-white"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
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
    <div 
      className="min-h-screen p-2 font-['Bangers',cursive] text-white"
      style={{ 
        backgroundColor: 'rgb(206, 206, 206)',
        backgroundImage: 'url(/lovable-uploads/bg.jpg)',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover'
      }}
    >
      <h1 className="text-center mt-2 mb-4 tracking-[8px] text-3xl">Ludo MG</h1>
      
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
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-white p-1"
        >
          {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        </Button>
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

      {/* Current Player Turn Indicator */}
      <div className="w-full max-w-sm mx-auto mb-2">
        <div className={cn(
          "text-center py-2 px-4 rounded-lg font-bold text-white text-sm",
          currentColor === 'blue' && "bg-blue-600",
          currentColor === 'red' && "bg-red-600",
          currentColor === 'green' && "bg-green-600",
          currentColor === 'yellow' && "bg-yellow-500"
        )}>
          {currentPlayerName}'s Turn
          {isAIThinking && <span className="ml-2 animate-pulse">🤔</span>}
        </div>
      </div>

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
        className="mb-2"
      />

      {/* Player Status */}
      <div className="w-full max-w-sm mx-auto grid grid-cols-2 gap-1 text-xs">
        {gameConfig.turnOrder.map(color => (
          <div key={color} className={cn(
            "flex flex-col items-center p-1 rounded border bg-white/20 text-white",
            color === currentColor && 'border-yellow-400 bg-yellow-500/30'
          )}>
            <div className={cn(
              "w-3 h-3 rounded-full mb-1",
              color === 'blue' && "bg-blue-500",
              color === 'red' && "bg-red-500", 
              color === 'green' && "bg-green-500",
              color === 'yellow' && "bg-yellow-500"
            )} />
            <span className={cn(
              "font-bold text-[10px] text-center",
              color === currentColor && 'text-yellow-200'
            )}>
              {gameConfig.playerNames[color] || color}
              {gameConfig.playerTypes[color] === 'ai' && ' (AI)'}
            </span>
            <span className="text-[8px] text-gray-300">
              {language === 'ar' ? 'منزل' : 'Home'}: {gameState.homeAreas[color].length}/4
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
