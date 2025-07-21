import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Users, Home } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { LudoBoardV2 } from './LudoBoardV2';
import { PlayerSetup } from './PlayerSetup';
import { MultiplayerLudoSetup } from './MultiplayerLudoSetup';
import { waktiSounds } from '@/services/waktiSounds';
import { useLudoMultiplayer } from '@/hooks/useLudoMultiplayer';
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
  const { currentRoom, players, updateGameState } = useLudoMultiplayer();
  
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
  const [showMultiplayerSetup, setShowMultiplayerSetup] = useState(false);
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
    const newGameState = { ...gameState };
    
    // Reset all positions
    for (let i = 1; i <= 52; i++) {
      newGameState.outerPosition[i] = [];
    }
    
    for (const color of ['blue', 'red', 'green', 'yellow'] as PlayerColor[]) {
      newGameState.privateAreas[color] = [];
      newGameState.homeAreas[color] = [];
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

    setGameState(newGameState);
    setGameConfig(config);
    setCurrentTurn(0);
    setGameStarted(true);
    setShowSetup(false);
    setShowPlayerSetup(false);
    setShowMultiplayerSetup(false);
    setWinner(null);
    setCanRoll(true);
    setIsAIThinking(false);
  }, [gameState]);

  const playSound = async (soundType: 'chime' | 'beep' | 'ding') => {
    if (soundEnabled) {
      await waktiSounds.playNotificationSound(soundType);
    }
  };

  // Check if player can make any moves
  const canPlayerMove = (color: PlayerColor, dice: number): boolean => {
    // Can move from private if dice is 6
    if (gameState.privateAreas[color].length > 0 && dice === 6) {
      return true;
    }
    
    // Can move from outer positions
    for (const pos in gameState.outerPosition) {
      if (gameState.outerPosition[pos].some(pawn => pawn.color === color)) {
        return true;
      }
    }
    
    // Can move from last line
    for (const pos in gameState.lastLine[color]) {
      if (gameState.lastLine[color][pos] && gameState.lastLine[color][pos].length > 0) {
        const currentPos = parseInt(pos);
        if (currentPos + dice <= 6) {
          return true;
        }
      }
    }
    
    return false;
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
          const currentPos = parseInt(pos);
          if (currentPos + dice <= 6) {
            availablePawns.push(pawn);
          }
        });
      }
    }
    
    return availablePawns;
  };

  // Get next position for a pawn based on dice roll
  const getNextCell = (pawn: Pawn, dice: number) => {
    const currentCell = parseInt(pawn.currentCell);
    const startCell = parseInt(pawn.startCell);
    const endCell = parseInt(pawn.endCell);
    
    let next = {
      cell: 0,
      area: 'outer' as GameArea
    };

    if (pawn.area === 'private') {
      next.area = 'outer';
      next.cell = startCell;
    } else if (pawn.area === 'outer') {
      let nextCell = currentCell + dice;
      
      // Handle wrapping around the track
      if (nextCell > 52) {
        nextCell = nextCell - 52;
      }
      
      // Check if entering last line
      if ((currentCell <= endCell && nextCell > endCell) || 
          (endCell < startCell && currentCell <= endCell && nextCell > endCell)) {
        next.area = 'last-line';
        const remaining = nextCell - endCell;
        next.cell = remaining;
        if (remaining === 6) {
          next.area = 'home';
          next.cell = 0;
        }
      } else {
        next.cell = nextCell;
      }
    } else if (pawn.area === 'last-line') {
      const nextPos = currentCell + dice;
      if (nextPos === 6) {
        next.area = 'home';
        next.cell = 0;
      } else if (nextPos < 6) {
        next.area = 'last-line';
        next.cell = nextPos;
      }
    }
    
    return next;
  };

  const rollDice = useCallback(() => {
    if (isRolling || winner || !canRoll) return;
    
    setIsRolling(true);
    setCanRoll(false);
    setHighlightedPawns(new Set());
    playSound('chime');
    
    setTimeout(() => {
      const newDiceValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(newDiceValue);
      setIsRolling(false);
      
      const currentColor = gameConfig?.turnOrder[currentTurn];
      if (currentColor) {
        const canMove = canPlayerMove(currentColor, newDiceValue);
        
        if (!canMove || gameState.homeAreas[currentColor].length === 4) {
          // No moves available or player already won
          setTimeout(() => nextTurn(newDiceValue), 1000);
        } else {
          const availablePawns = getAvailablePawns(currentColor, newDiceValue);
          setHighlightedPawns(new Set(availablePawns.map(p => p.name)));
          
          // If current player is AI, make move automatically
          if (gameConfig?.playerTypes[currentColor] === 'ai') {
            setIsAIThinking(true);
            setTimeout(() => {
              makeAIMove(currentColor, newDiceValue);
              setIsAIThinking(false);
            }, 1500);
          } else {
            setCanRoll(false); // Human must make a move first
          }
        }
      }
    }, 1200);
  }, [isRolling, currentTurn, gameConfig, gameState, winner, canRoll]);

  const makeAIMove = (color: PlayerColor, dice: number) => {
    const availablePawns = getAvailablePawns(color, dice);
    
    if (availablePawns.length === 0) {
      nextTurn(dice);
      return;
    }

    // Simple AI logic - prioritize getting pawns out, then move closest to home
    let bestMove = availablePawns[0];
    
    // Prioritize getting pawns out of private area
    const privatePawns = availablePawns.filter(p => p.area === 'private');
    if (privatePawns.length > 0) {
      bestMove = privatePawns[0];
    } else {
      // Choose pawn closest to completing the track
      bestMove = availablePawns.reduce((best, current) => {
        if (current.area === 'last-line') return current; // Prioritize last line pawns
        return best;
      }, availablePawns[0]);
    }
    
    movePawn(bestMove, dice);
  };

  const movePawn = (pawn: Pawn, dice: number) => {
    const newGameState = { ...gameState };
    
    if (pawn.area === 'private') {
      // Move from private to outer track
      const pawnIndex = newGameState.privateAreas[pawn.color].findIndex(p => p.name === pawn.name);
      if (pawnIndex !== -1) {
        newGameState.privateAreas[pawn.color].splice(pawnIndex, 1);
        const startPos = TRACK_START_POSITIONS[pawn.color];
        pawn.currentCell = startPos.toString();
        pawn.area = 'outer';
        
        // Handle capture
        const existingPawns = newGameState.outerPosition[startPos] || [];
        const enemyPawns = existingPawns.filter(p => p.color !== pawn.color);
        enemyPawns.forEach(enemyPawn => {
          // Send enemy pawn back to private area
          enemyPawn.area = 'private';
          enemyPawn.currentCell = `${enemyPawn.color}-private-${enemyPawn.id}`;
          newGameState.privateAreas[enemyPawn.color].push(enemyPawn);
        });
        
        newGameState.outerPosition[startPos] = [pawn, ...existingPawns.filter(p => p.color === pawn.color)];
      }
    } else if (pawn.area === 'outer') {
      const next = getNextCell(pawn, dice);
      
      // Remove from current position
      const currentPos = parseInt(pawn.currentCell);
      const currentPosIndex = newGameState.outerPosition[currentPos]?.findIndex(p => p.name === pawn.name);
      if (currentPosIndex !== -1) {
        newGameState.outerPosition[currentPos].splice(currentPosIndex, 1);
      }
      
      pawn.currentCell = next.cell.toString();
      pawn.area = next.area;
      
      if (next.area === 'outer') {
        // Handle capture
        const existingPawns = newGameState.outerPosition[next.cell] || [];
        const enemyPawns = existingPawns.filter(p => p.color !== pawn.color);
        enemyPawns.forEach(enemyPawn => {
          enemyPawn.area = 'private';
          enemyPawn.currentCell = `${enemyPawn.color}-private-${enemyPawn.id}`;
          newGameState.privateAreas[enemyPawn.color].push(enemyPawn);
        });
        
        newGameState.outerPosition[next.cell] = [pawn, ...existingPawns.filter(p => p.color === pawn.color)];
      } else if (next.area === 'last-line') {
        if (!newGameState.lastLine[pawn.color][next.cell]) {
          newGameState.lastLine[pawn.color][next.cell] = [];
        }
        newGameState.lastLine[pawn.color][next.cell].push(pawn);
      } else if (next.area === 'home') {
        newGameState.homeAreas[pawn.color].push(pawn);
        playSound('ding');
      }
    } else if (pawn.area === 'last-line') {
      const next = getNextCell(pawn, dice);
      
      // Remove from current position
      const currentPos = parseInt(pawn.currentCell);
      const currentPosIndex = newGameState.lastLine[pawn.color][currentPos]?.findIndex(p => p.name === pawn.name);
      if (currentPosIndex !== -1) {
        newGameState.lastLine[pawn.color][currentPos].splice(currentPosIndex, 1);
      }
      
      pawn.currentCell = next.cell.toString();
      pawn.area = next.area;
      
      if (next.area === 'last-line') {
        if (!newGameState.lastLine[pawn.color][next.cell]) {
          newGameState.lastLine[pawn.color][next.cell] = [];
        }
        newGameState.lastLine[pawn.color][next.cell].push(pawn);
      } else if (next.area === 'home') {
        newGameState.homeAreas[pawn.color].push(pawn);
        playSound('ding');
      }
    }
    
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

  const nextTurn = (dice: number) => {
    if (dice !== 6) {
      setCurrentTurn(prev => (prev + 1) % (gameConfig?.turnOrder.length || 4));
    }
    setCanRoll(true);
  };

  const handlePawnClick = (pawn: Pawn) => {
    if (!highlightedPawns.has(pawn.name)) return;
    if (gameConfig?.playerTypes[pawn.color] === 'ai') return;
    if (winner) return;
    
    movePawn(pawn, diceValue);
  };

  const handleModeSelect = (mode: GameConfig['mode']) => {
    setSelectedMode(mode);
    if (mode === 'multiplayer') {
      setShowMultiplayerSetup(true);
    } else {
      setShowPlayerSetup(true);
    }
  };

  const handlePlayerSetupComplete = (playerNames: Record<string, string>) => {
    if (!selectedMode) return;
    
    const config = createGameConfig(selectedMode, playerNames);
    initializeGame(config);
  };

  const handleMultiplayerGameStart = (roomId: string, roomPlayers: any[]) => {
    const playerNames: Record<string, string> = {};
    const turnOrder: PlayerColor[] = [];
    const playerTypes: Record<PlayerColor, PlayerType> = {} as Record<PlayerColor, PlayerType>;

    roomPlayers.forEach(player => {
      playerNames[player.player_color] = player.player_name;
      turnOrder.push(player.player_color as PlayerColor);
      playerTypes[player.player_color as PlayerColor] = player.player_type as PlayerType;
    });

    const config: GameConfig = {
      mode: 'multiplayer',
      playerTypes,
      turnOrder,
      playerNames
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
    setShowMultiplayerSetup(false);
    setSelectedMode(null);
    setGameStarted(false);
    setIsAIThinking(false);
  };

  const handleBackToModeSelection = () => {
    setShowPlayerSetup(false);
    setShowMultiplayerSetup(false);
    setSelectedMode(null);
  };

  if (showMultiplayerSetup) {
    return (
      <MultiplayerLudoSetup
        onGameStart={handleMultiplayerGameStart}
        onBack={handleBackToModeSelection}
      />
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
      <div className="p-6 text-center">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={onBack} variant="outline">
            <Home className="w-4 h-4 mr-2" />    
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
          
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            {language === 'ar' ? 'اختر نمط اللعبة' : 'Choose Game Mode'}
          </h2>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="space-y-4">
          {modes.map(mode => (
            <Button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id as GameConfig['mode'])}
              className="w-full h-16 text-lg flex items-center justify-center space-x-2"
              variant="outline"
            >
              {mode.id === 'multiplayer' && <Users className="w-5 h-5" />}
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
    <div className="flex flex-col items-center space-y-4 min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-center">
        <Button onClick={onBack} variant="outline" size="sm">
          <Home className="w-4 h-4 mr-1" />
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </div>

      {/* Winner Banner */}
      {winner && (
        <div className="w-full max-w-lg p-4 bg-green-100 border border-green-300 rounded-lg text-center">
          <p className="text-lg font-bold text-green-800">
            🏆 {gameConfig.playerNames[winner] || winner} {language === 'ar' ? 'فاز!' : 'Wins!'}
          </p>
          <Button onClick={handlePlayAgain} className="mt-2" size="sm">
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
      />

      {/* Player Status */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-2 text-xs">
        {gameConfig.turnOrder.map(color => (
          <div key={color} className={cn(
            "flex flex-col items-center p-2 rounded border",
            color === currentColor && 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
          )}>
            <div className={cn(
              "w-4 h-4 rounded-full mb-1",
              color === 'blue' && "bg-blue-500",
              color === 'red' && "bg-red-500", 
              color === 'green' && "bg-green-500",
              color === 'yellow' && "bg-yellow-500"
            )} />
            <span className={cn(
              "font-bold text-xs text-center",
              color === currentColor && 'text-yellow-800 dark:text-yellow-200'
            )}>
              {gameConfig.playerNames[color] || color}
              {gameConfig.playerTypes[color] === 'ai' && ' (AI)'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'في المنزل' : 'Home'}: {gameState.homeAreas[color].length}/4
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
