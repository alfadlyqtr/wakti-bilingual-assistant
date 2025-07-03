import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Zap, Play, Pause } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface SolitaireGameProps {
  onBack: () => void;
  onStatsChange?: (stats: { score: number; moves: number; timer: number }) => void;
}

// Card types and constants
const SUITS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
} as const;

const FACES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

const COLORS = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black'
} as const;

type Suit = keyof typeof SUITS;
type Face = typeof FACES[number];
type Color = 'red' | 'black';

interface Card {
  suit: Suit;
  face: Face;
  faceUp: boolean;
  id: string;
}

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: {
    hearts: Card[];
    diamonds: Card[];
    clubs: Card[];
    spades: Card[];
  };
  tableau: Card[][];
  selectedCards: Card[];
  selectedPile: number | null;
  score: number;
  moves: number;
  gameWon: boolean;
  autoComplete: boolean;
}

// Utility functions
const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of Object.keys(SUITS) as Suit[]) {
    for (const face of FACES) {
      deck.push({
        suit,
        face,
        faceUp: false,
        id: `${suit}-${face}`
      });
    }
  }
  return shuffleDeck(deck);
};

const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const getFaceValue = (face: Face): number => {
  if (face === 'A') return 1;
  if (face === 'J') return 11;
  if (face === 'Q') return 12;
  if (face === 'K') return 13;
  return parseInt(face);
};

const canPlaceOnTableau = (card: Card, targetPile: Card[]): boolean => {
  if (targetPile.length === 0) {
    return getFaceValue(card.face) === 13; // Only King on empty pile
  }
  const topCard = targetPile[targetPile.length - 1];
  return (
    COLORS[card.suit] !== COLORS[topCard.suit] &&
    getFaceValue(card.face) === getFaceValue(topCard.face) - 1
  );
};

const canPlaceOnFoundation = (card: Card, foundation: Card[]): boolean => {
  if (foundation.length === 0) {
    return getFaceValue(card.face) === 1; // Only Ace on empty foundation
  }
  const topCard = foundation[foundation.length - 1];
  return (
    card.suit === topCard.suit &&
    getFaceValue(card.face) === getFaceValue(topCard.face) + 1
  );
};

const initializeGame = (): GameState => {
  const deck = createDeck();
  const tableau: Card[][] = [[], [], [], [], [], [], []];
  
  // Deal cards to tableau
  let cardIndex = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[cardIndex++];
      card.faceUp = row === col; // Only top card face up
      tableau[col].push(card);
    }
  }

  // Remaining cards go to stock
  const stock = deck.slice(cardIndex);

  return {
    stock,
    waste: [],
    foundations: {
      hearts: [],
      diamonds: [],
      clubs: [],
      spades: []
    },
    tableau,
    selectedCards: [],
    selectedPile: null,
    score: 0,
    moves: 0,
    gameWon: false,
    autoComplete: false
  };
};

export function SolitaireGame({ onBack, onStatsChange }: SolitaireGameProps) {
  const { language } = useTheme();
  const [gameState, setGameState] = useState<GameState>(initializeGame);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && !gameState.gameWon) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, gameState.gameWon]);

  // Update parent with stats
  useEffect(() => {
    onStatsChange?.({ score: gameState.score, moves: gameState.moves, timer });
  }, [gameState.score, gameState.moves, timer, onStatsChange]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const drawFromStock = useCallback(() => {
    setGameState(prev => {
      if (prev.stock.length === 0) {
        // Reset stock from waste
        return {
          ...prev,
          stock: [...prev.waste].reverse().map(card => ({ ...card, faceUp: false })),
          waste: [],
          moves: prev.moves + 1
        };
      }
      
      const newStock = [...prev.stock];
      const drawnCard = newStock.pop()!;
      drawnCard.faceUp = true;
      
      return {
        ...prev,
        stock: newStock,
        waste: [...prev.waste, drawnCard],
        moves: prev.moves + 1
      };
    });
  }, []);

  const selectCard = useCallback((card: Card, source: 'waste' | 'foundation' | 'tableau', pileIndex?: number) => {
    setGameState(prev => {
      if (prev.selectedCards.length > 0) {
        // Try to place selected cards
        const targetCards = prev.selectedCards;
        let newState = { ...prev };
        let placed = false;

        if (source === 'foundation') {
          const foundationKey = card.suit;
          if (targetCards.length === 1 && canPlaceOnFoundation(targetCards[0], prev.foundations[foundationKey])) {
            newState.foundations[foundationKey] = [...prev.foundations[foundationKey], targetCards[0]];
            placed = true;
          }
        } else if (source === 'tableau' && pileIndex !== undefined) {
          if (canPlaceOnTableau(targetCards[0], prev.tableau[pileIndex])) {
            newState.tableau[pileIndex] = [...prev.tableau[pileIndex], ...targetCards];
            placed = true;
          }
        }

        if (placed) {
          // Remove cards from source
          if (prev.selectedPile !== null) {
            newState.tableau[prev.selectedPile] = prev.tableau[prev.selectedPile].slice(0, -targetCards.length);
            // Flip top card if it exists
            const topCardIndex = newState.tableau[prev.selectedPile].length - 1;
            if (topCardIndex >= 0 && !newState.tableau[prev.selectedPile][topCardIndex].faceUp) {
              newState.tableau[prev.selectedPile][topCardIndex].faceUp = true;
            }
          } else if (prev.waste.length > 0 && prev.waste[prev.waste.length - 1].id === targetCards[0].id) {
            newState.waste = prev.waste.slice(0, -1);
          }

          newState.score += targetCards.length * 10;
          newState.moves += 1;
          newState.selectedCards = [];
          newState.selectedPile = null;

          // Check for win
          const totalFoundationCards = Object.values(newState.foundations).reduce((sum, pile) => sum + pile.length, 0);
          if (totalFoundationCards === 52) {
            newState.gameWon = true;
            setIsTimerRunning(false);
          }

          return newState;
        }

        // Clear selection if can't place
        return {
          ...prev,
          selectedCards: [],
          selectedPile: null
        };
      } else {
        // Select new cards
        if (source === 'waste' && prev.waste.length > 0) {
          const topWaste = prev.waste[prev.waste.length - 1];
          if (topWaste.id === card.id) {
            return {
              ...prev,
              selectedCards: [topWaste],
              selectedPile: null
            };
          }
        } else if (source === 'tableau' && pileIndex !== undefined) {
          const pile = prev.tableau[pileIndex];
          const cardIndex = pile.findIndex(c => c.id === card.id);
          if (cardIndex >= 0 && card.faceUp) {
            const selectedCards = pile.slice(cardIndex);
            // Check if sequence is valid (descending alternating colors)
            let validSequence = true;
            for (let i = 1; i < selectedCards.length; i++) {
              const prevCard = selectedCards[i - 1];
              const currCard = selectedCards[i];
              if (
                COLORS[prevCard.suit] === COLORS[currCard.suit] ||
                getFaceValue(prevCard.face) !== getFaceValue(currCard.face) + 1
              ) {
                validSequence = false;
                break;
              }
            }
            
            if (validSequence) {
              return {
                ...prev,
                selectedCards,
                selectedPile: pileIndex
              };
            }
          }
        }
        
        return prev;
      }
    });
  }, []);

  const selectEmptySpace = useCallback((target: 'foundation' | 'tableau', suitOrIndex: Suit | number) => {
    setGameState(prev => {
      if (prev.selectedCards.length === 0) return prev;

      let newState = { ...prev };
      let placed = false;

      if (target === 'foundation' && typeof suitOrIndex === 'string') {
        const suit = suitOrIndex as Suit;
        if (prev.selectedCards.length === 1 && canPlaceOnFoundation(prev.selectedCards[0], prev.foundations[suit])) {
          newState.foundations[suit] = [...prev.foundations[suit], prev.selectedCards[0]];
          placed = true;
        }
      } else if (target === 'tableau' && typeof suitOrIndex === 'number') {
        const pileIndex = suitOrIndex;
        if (canPlaceOnTableau(prev.selectedCards[0], prev.tableau[pileIndex])) {
          newState.tableau[pileIndex] = [...prev.tableau[pileIndex], ...prev.selectedCards];
          placed = true;
        }
      }

      if (placed) {
        // Remove cards from source
        if (prev.selectedPile !== null) {
          newState.tableau[prev.selectedPile] = prev.tableau[prev.selectedPile].slice(0, -prev.selectedCards.length);
          // Flip top card if it exists
          const topCardIndex = newState.tableau[prev.selectedPile].length - 1;
          if (topCardIndex >= 0 && !newState.tableau[prev.selectedPile][topCardIndex].faceUp) {
            newState.tableau[prev.selectedPile][topCardIndex].faceUp = true;
          }
        } else if (prev.waste.length > 0) {
          newState.waste = prev.waste.slice(0, -1);
        }

        newState.score += prev.selectedCards.length * 10;
        newState.moves += 1;
        newState.selectedCards = [];
        newState.selectedPile = null;

        // Check for win
        const totalFoundationCards = Object.values(newState.foundations).reduce((sum, pile) => sum + pile.length, 0);
        if (totalFoundationCards === 52) {
          newState.gameWon = true;
          setIsTimerRunning(false);
        }

        return newState;
      }

      return prev;
    });
  }, []);

  const newGame = useCallback(() => {
    setGameState(initializeGame());
    setTimer(0);
    setIsTimerRunning(true);
  }, []);

  const toggleTimer = useCallback(() => {
    setIsTimerRunning(prev => !prev);
  }, []);

  const autoComplete = useCallback(() => {
    // Simple auto-complete logic - move all face-up cards to foundations if possible
    setGameState(prev => {
      let newState = { ...prev };
      let moved = false;

      // Try to move from waste
      if (newState.waste.length > 0) {
        const wasteCard = newState.waste[newState.waste.length - 1];
        for (const suit of Object.keys(SUITS) as Suit[]) {
          if (canPlaceOnFoundation(wasteCard, newState.foundations[suit])) {
            newState.foundations[suit] = [...newState.foundations[suit], wasteCard];
            newState.waste = newState.waste.slice(0, -1);
            moved = true;
            break;
          }
        }
      }

      // Try to move from tableau
      for (let i = 0; i < 7; i++) {
        const pile = newState.tableau[i];
        if (pile.length > 0) {
          const topCard = pile[pile.length - 1];
          if (topCard.faceUp) {
            for (const suit of Object.keys(SUITS) as Suit[]) {
              if (canPlaceOnFoundation(topCard, newState.foundations[suit])) {
                newState.foundations[suit] = [...newState.foundations[suit], topCard];
                newState.tableau[i] = pile.slice(0, -1);
                // Flip next card if exists
                if (newState.tableau[i].length > 0 && !newState.tableau[i][newState.tableau[i].length - 1].faceUp) {
                  newState.tableau[i][newState.tableau[i].length - 1].faceUp = true;
                }
                moved = true;
                break;
              }
            }
          }
        }
      }

      if (moved) {
        newState.moves += 1;
        newState.score += 10;
        
        // Check for win
        const totalFoundationCards = Object.values(newState.foundations).reduce((sum, pile) => sum + pile.length, 0);
        if (totalFoundationCards === 52) {
          newState.gameWon = true;
          setIsTimerRunning(false);
        }
      }

      return newState;
    });
  }, []);

  const renderCard = (card: Card, isSelected: boolean = false) => {
    const isRed = COLORS[card.suit] === 'red';
    
    return (
      <div 
        className={`
          w-12 h-16 rounded-lg border border-border/20 flex flex-col items-center justify-center text-sm font-bold
          transition-all duration-200 cursor-pointer relative
          ${card.faceUp 
            ? `bg-gradient-to-br from-background to-background/90 ${isRed ? 'text-red-500' : 'text-foreground'} shadow-lg border-border`
            : 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary/30 shadow-md'
          }
          ${isSelected ? 'ring-2 ring-accent shadow-glow scale-105 z-10' : 'hover:scale-102 hover:shadow-lg'}
        `}
      >
        {card.faceUp ? (
          <>
            <span className="text-xs leading-none">{card.face}</span>
            <span className="text-lg leading-none">{SUITS[card.suit]}</span>
          </>
        ) : (
          <div className="w-full h-full rounded-lg bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center">
            <span className="text-xs font-bold opacity-60">W</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4">{/* Game Controls */}

      <div className="flex items-center justify-center gap-2 pb-2">
        <Button size="sm" onClick={newGame} variant="outline">
          <RotateCcw className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'لعبة جديدة' : 'New Game'}
        </Button>
        <Button size="sm" onClick={toggleTimer} variant="outline">
          {isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="sm" onClick={autoComplete} variant="outline">
          <Zap className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'إكمال تلقائي' : 'Auto Complete'}
        </Button>
      </div>

      {/* Game Board */}
      <div className="flex-1 space-y-3">
        {/* Top Row: Stock, Waste, and Foundations */}
        <div className="flex justify-between items-start mb-4">
          {/* Stock and Waste */}
          <div className="flex gap-3">
            <div 
              className="w-12 h-16 rounded-lg border-2 border-dashed border-accent/40 flex items-center justify-center cursor-pointer hover:border-accent/60 transition-colors bg-accent/5"
              onClick={drawFromStock}
            >
              {gameState.stock.length > 0 ? renderCard(gameState.stock[0]) : (
                <span className="text-xs text-muted-foreground">Stock</span>
              )}
            </div>
            <div className="w-12 h-16 rounded-lg border border-border/30 flex items-center justify-center bg-background/50">
              {gameState.waste.length > 0 ? (
                <div onClick={() => selectCard(gameState.waste[gameState.waste.length - 1], 'waste')}>
                  {renderCard(gameState.waste[gameState.waste.length - 1], 
                    gameState.selectedCards.length > 0 && 
                    gameState.selectedCards[0].id === gameState.waste[gameState.waste.length - 1]?.id
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Waste</span>
              )}
            </div>
          </div>

          {/* Foundations */}
          <div className="flex gap-2">
            {Object.entries(SUITS).map(([suit, symbol]) => (
              <div 
                key={suit}
                className="w-12 h-16 rounded-lg border border-border/30 flex items-center justify-center cursor-pointer hover:bg-accent/5 transition-colors bg-background/50"
                onClick={() => selectEmptySpace('foundation', suit as Suit)}
              >
                {gameState.foundations[suit as Suit].length > 0 ? (
                  <div onClick={(e) => {
                    e.stopPropagation();
                    const topCard = gameState.foundations[suit as Suit][gameState.foundations[suit as Suit].length - 1];
                    selectCard(topCard, 'foundation');
                  }}>
                    {renderCard(gameState.foundations[suit as Suit][gameState.foundations[suit as Suit].length - 1])}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xl font-bold">{symbol}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="flex gap-2 justify-center">
          {gameState.tableau.map((pile, pileIndex) => (
            <div 
              key={pileIndex}
              className="flex flex-col gap-1 min-h-20 w-12"
              onClick={() => pile.length === 0 && selectEmptySpace('tableau', pileIndex)}
            >
              {pile.length === 0 ? (
                <div className="w-12 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/50 transition-colors bg-accent/5" />
              ) : (
                pile.map((card, cardIndex) => (
                  <div 
                    key={card.id}
                    className={`${cardIndex > 0 ? '-mt-10' : ''} relative z-${cardIndex}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectCard(card, 'tableau', pileIndex);
                    }}
                  >
                    {renderCard(card, 
                      gameState.selectedCards.some(selectedCard => selectedCard.id === card.id)
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Win Message */}
      {gameState.gameWon && (
        <div className="text-center p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-lg border border-emerald-500/20 shadow-lg">
          <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {language === 'ar' ? '🎉 مبروك!' : '🎉 Congratulations!'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'النتيجة النهائية' : 'Final Score'}: {gameState.score} | {language === 'ar' ? 'الوقت' : 'Time'}: {formatTime(timer)}
          </p>
        </div>
      )}
    </div>
  );
}