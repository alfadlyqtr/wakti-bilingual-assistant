import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { LudoBoard } from './LudoBoard';
import { PlayerSetup } from './PlayerSetup';
import { DiceComponent } from './DiceComponent';
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
  mode: '1v3' | '2v2' | '3v1' | '4human' | '1v1';
  playerTypes: Record<PlayerColor, PlayerType>;
  turnOrder: PlayerColor[];
  playerNames: Record<string, string>;
}

const SAFE_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];
const PAWN_NUMBER = 4;

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
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<PlayerColor | null>(null);

  // Initialize game state
  useEffect(() => {
    const newGameState = { ...gameState };
    
    // Initialize outer positions
    for (let i = 1; i <= 52; i++) {
      newGameState.outerPosition[i] = [];
    }
    
    // Initialize last lines
    for (const color of ['blue', 'red', 'green', 'yellow'] as PlayerColor[]) {
      for (let i = 1; i <= 5; i++) {
        newGameState.lastLine[color][i] = [];
      }
    }
    
    setGameState(newGameState);
  }, []);

  const createPawn = (id: number, color: PlayerColor): Pawn => {
    const cellConfig = {
      blue: { startCell: '1', endCell: '51' },
      red: { startCell: '14', endCell: '12' },
      green: { startCell: '27', endCell: '25' },
      yellow: { startCell: '40', endCell: '38' }
    };

    return {
      id,
      name: `${color}-${id}`,
      color,
      startCell: cellConfig[color].startCell,
      endCell: cellConfig[color].endCell,
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
    setWinner(null);
  }, [gameState]);

  const playSound = async (soundType: 'chime' | 'beep' | 'ding') => {
    if (soundEnabled) {
      await waktiSounds.playNotificationSound(soundType);
    }
  };

  const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min)) + min;
  };

  const rollDice = useCallback(() => {
    if (isRolling || winner) return;
    
    setIsRolling(true);
    setHighlightedPawns(new Set());
    playSound('chime');
    
    setTimeout(() => {
      const newDiceValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(newDiceValue);
      setIsRolling(false);
      
      // Check if current player can move
      const currentColor = gameConfig?.turnOrder[currentTurn];
      if (currentColor) {
        const canMove = canPlayerMove(currentColor, newDiceValue);
        if (!canMove) {
          nextTurn(newDiceValue);
        } else {
          highlightAvailablePawns(currentColor, newDiceValue);
          
          // If current player is AI, make move automatically
          if (gameConfig?.playerTypes[currentColor] === 'ai') {
            setTimeout(() => makeAIMove(currentColor, newDiceValue), 1000);
          }
        }
      }
    }, 1000);
  }, [isRolling, currentTurn, gameConfig, gameState, winner]);

  const canPlayerMove = (color: PlayerColor, dice: number): boolean => {
    // Check if can move from private (needs 6)
    if (gameState.privateAreas[color].length > 0 && dice === 6) {
      return true;
    }
    
    // Check if can move from outer positions
    for (const pos in gameState.outerPosition) {
      if (gameState.outerPosition[pos].some(pawn => pawn.color === color)) {
        return true;
      }
    }
    
    // Check if can move from last line
    for (const pos in gameState.lastLine[color]) {
      if (gameState.lastLine[color][pos].length > 0) {
        const currentPos = parseInt(pos);
        if (currentPos + dice <= 6) {
          return true;
        }
      }
    }
    
    return false;
  };

  const highlightAvailablePawns = (color: PlayerColor, dice: number) => {
    const highlighted = new Set<string>();
    
    // Highlight pawns in private area if dice is 6
    if (dice === 6) {
      gameState.privateAreas[color].forEach(pawn => {
        highlighted.add(pawn.name);
      });
    }
    
    // Highlight pawns in outer positions
    for (const pos in gameState.outerPosition) {
      gameState.outerPosition[pos].forEach(pawn => {
        if (pawn.color === color) {
          highlighted.add(pawn.name);
        }
      });
    }
    
    // Highlight pawns in last line that can move
    for (const pos in gameState.lastLine[color]) {
      gameState.lastLine[color][pos].forEach(pawn => {
        const currentPos = parseInt(pos);
        if (currentPos + dice <= 6) {
          highlighted.add(pawn.name);
        }
      });
    }
    
    setHighlightedPawns(highlighted);
  };

  const makeAIMove = (color: PlayerColor, dice: number) => {
    // Simple AI logic - prioritize: 1) Get pawns out, 2) Move closest to home, 3) Capture opponents
    let bestMove: { pawn: Pawn; score: number } | null = null;
    
    // Check pawns in private area
    if (dice === 6 && gameState.privateAreas[color].length > 0) {
      const pawn = gameState.privateAreas[color][0];
      bestMove = { pawn, score: 100 };
    }
    
    // Check pawns in outer positions
    if (!bestMove) {
      for (const pos in gameState.outerPosition) {
        gameState.outerPosition[pos].forEach(pawn => {
          if (pawn.color === color) {
            let score = 50;
            const currentPos = parseInt(pos);
            const endPos = parseInt(pawn.endCell);
            const distanceToEnd = Math.abs(currentPos - endPos);
            score += Math.max(0, 52 - distanceToEnd);
            
            if (!bestMove || score > bestMove.score) {
              bestMove = { pawn, score };
            }
          }
        });
      }
    }
    
    // Check pawns in last line
    if (!bestMove) {
      for (const pos in gameState.lastLine[color]) {
        gameState.lastLine[color][pos].forEach(pawn => {
          const currentPos = parseInt(pos);
          if (currentPos + dice <= 6) {
            const score = 200 + currentPos;
            if (!bestMove || score > bestMove.score) {
              bestMove = { pawn, score };
            }
          }
        });
      }
    }
    
    if (bestMove) {
      movePawn(bestMove.pawn, dice);
    }
  };

  const movePawn = (pawn: Pawn, dice: number) => {
    const newGameState = { ...gameState };
    
    // Move logic implementation
    if (pawn.area === 'private') {
      // Move from private to outer
      const pawnIndex = newGameState.privateAreas[pawn.color].findIndex(p => p.name === pawn.name);
      if (pawnIndex !== -1) {
        newGameState.privateAreas[pawn.color].splice(pawnIndex, 1);
        pawn.currentCell = pawn.startCell;
        pawn.area = 'outer';
        newGameState.outerPosition[parseInt(pawn.startCell)].push(pawn);
      }
    } else if (pawn.area === 'outer') {
      // Move within outer or to last line
      const currentPos = parseInt(pawn.currentCell);
      const endPos = parseInt(pawn.endCell);
      let nextPos = currentPos + dice;
      
      // Remove from current position
      const currentPosIndex = newGameState.outerPosition[currentPos].findIndex(p => p.name === pawn.name);
      if (currentPosIndex !== -1) {
        newGameState.outerPosition[currentPos].splice(currentPosIndex, 1);
      }
      
      // Check if moving to last line
      if (currentPos >= endPos - 6 && currentPos <= endPos && nextPos > endPos) {
        const remaining = nextPos - endPos;
        if (remaining === 6) {
          // Move to home
          pawn.area = 'home';
          pawn.currentCell = '0';
          newGameState.homeAreas[pawn.color].push(pawn);
          playSound('ding');
        } else {
          // Move to last line
          pawn.area = 'last-line';
          pawn.currentCell = remaining.toString();
          newGameState.lastLine[pawn.color][remaining].push(pawn);
        }
      } else {
        // Stay in outer
        if (nextPos > 52) {
          nextPos = nextPos - 52;
        }
        pawn.currentCell = nextPos.toString();
        newGameState.outerPosition[nextPos].push(pawn);
      }
    } else if (pawn.area === 'last-line') {
      // Move within last line or to home
      const currentPos = parseInt(pawn.currentCell);
      const nextPos = currentPos + dice;
      
      // Remove from current position
      const currentPosIndex = newGameState.lastLine[pawn.color][currentPos].findIndex(p => p.name === pawn.name);
      if (currentPosIndex !== -1) {
        newGameState.lastLine[pawn.color][currentPos].splice(currentPosIndex, 1);
      }
      
      if (nextPos === 6) {
        // Move to home
        pawn.area = 'home';
        pawn.currentCell = '0';
        newGameState.homeAreas[pawn.color].push(pawn);
        playSound('ding');
      } else {
        // Stay in last line
        pawn.currentCell = nextPos.toString();
        newGameState.lastLine[pawn.color][nextPos].push(pawn);
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
  };

  const handlePawnClick = (pawn: Pawn) => {
    if (!highlightedPawns.has(pawn.name)) return;
    if (gameConfig?.playerTypes[pawn.color] === 'ai') return;
    if (winner) return;
    
    movePawn(pawn, diceValue);
  };

  const handleModeSelect = (mode: GameConfig['mode']) => {
    setSelectedMode(mode);
    setShowPlayerSetup(true);
  };

  const handlePlayerSetupComplete = (playerNames: Record<string, string>) => {
    if (!selectedMode) return;
    
    const config = createGameConfig(selectedMode, playerNames);
    initializeGame(config);
  };

  const createGameConfig = (mode: GameConfig['mode'], playerNames: Record<string, string>): GameConfig => {
    const configs: Record<GameConfig['mode'], Omit<GameConfig, 'playerNames'>> = {
      '1v3': {
        mode: '1v3',
        playerTypes: { blue: 'human', red: 'ai', green: 'ai', yellow: 'ai' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '2v2': {
        mode: '2v2',
        playerTypes: { blue: 'human', red: 'ai', green: 'human', yellow: 'ai' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '3v1': {
        mode: '3v1',
        playerTypes: { blue: 'human', red: 'human', green: 'human', yellow: 'ai' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '4human': {
        mode: '4human',
        playerTypes: { blue: 'human', red: 'human', green: 'human', yellow: 'human' },
        turnOrder: ['blue', 'red', 'green', 'yellow']
      },
      '1v1': {
        mode: '1v1',
        playerTypes: { blue: 'human', red: 'human', green: 'ai', yellow: 'ai' },
        turnOrder: ['blue', 'red']
      }
    };

    return { ...configs[mode], playerNames };
  };

  const handlePlayAgain = () => {
    setWinner(null);
    setShowSetup(true);
    setShowPlayerSetup(false);
    setSelectedMode(null);
    setGameStarted(false);
  };

  const handleBackToModeSelection = () => {
    setShowPlayerSetup(false);
    setSelectedMode(null);
  };

  if (showPlayerSetup && selectedMode) {
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
      { id: '1v1', name: language === 'ar' ? '1 ضد 1' : '1 vs 1' }
    ];

    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold mb-6 text-slate-700 dark:text-slate-300">
          {language === 'ar' ? 'اختر نمط اللعبة' : 'Choose Game Mode'}
        </h2>
        
        <div className="space-y-4">
          {modes.map(mode => (
            <Button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id as GameConfig['mode'])}
              className="w-full h-16 text-lg"
              variant="outline"
            >
              {mode.name}
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
    <div className="flex flex-col items-center p-4 space-y-4">
      {/* Sound Toggle */}
      <div className="w-full max-w-md flex justify-end">
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
        <div className="w-full max-w-md p-4 bg-green-100 border border-green-300 rounded-lg text-center">
          <p className="text-lg font-bold text-green-800">
            🏆 {gameConfig.playerNames[winner] || winner} {language === 'ar' ? 'فاز!' : 'Wins!'}
          </p>
          <Button onClick={handlePlayAgain} className="mt-2">
            {language === 'ar' ? 'العب مرة أخرى' : 'Play Again'}
          </Button>
        </div>
      )}

      {/* Game Board */}
      <LudoBoard
        gameState={gameState}
        highlightedPawns={highlightedPawns}
        onPawnClick={handlePawnClick}
      />

      {/* Game Controls */}
      <div className={cn(
        "w-full max-w-md p-4 rounded-lg text-white",
        currentColor === 'blue' && 'bg-blue-600',
        currentColor === 'red' && 'bg-red-600',
        currentColor === 'green' && 'bg-green-600',
        currentColor === 'yellow' && 'bg-yellow-600'
      )}>
        <div className="text-center mb-4">
          <p className="text-lg font-bold">
            {currentPlayerName}'s Turn {isCurrentPlayerAI ? '(AI)' : ''}
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <DiceComponent
            value={diceValue}
            isRolling={isRolling}
            onRoll={rollDice}
            disabled={isCurrentPlayerAI || winner !== null}
            language={language}
          />
        </div>
      </div>

      {/* Game Stats */}
      <div className="w-full max-w-md p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h3 className="font-bold mb-2 text-slate-700 dark:text-slate-300">
          {language === 'ar' ? 'حالة اللعبة' : 'Game Status'}
        </h3>
        {gameConfig.turnOrder.map(color => (
          <div key={color} className="flex justify-between items-center mb-1">
            <span className={cn(
              "capitalize",
              color === currentColor && 'font-bold',
              "text-slate-600 dark:text-slate-400"
            )}>
              {gameConfig.playerNames[color] || color} {gameConfig.playerTypes[color] === 'ai' ? '(AI)' : ''}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'ar' ? 'في المنزل' : 'Home'}: {gameState.homeAreas[color].length}/4
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
