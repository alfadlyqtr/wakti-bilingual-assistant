import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Zap, Play, Pause } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface SolitaireGameProps {
  onBack: () => void;
  onStatsChange?: (stats: { score: number; moves: number; timer: number }) => void;
  onActionsChange?: (actions: {
    newGame: () => void;
    toggleTimer: () => void;
    autoComplete: () => void;
  }) => void;
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

export function SolitaireGame({ onBack, onStatsChange, onActionsChange }: SolitaireGameProps) {
  const { language } = useTheme();
  const [gameState, setGameState] = useState<GameState>(initializeGame);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

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

  // Update parent with stats and actions
  useEffect(() => {
    onStatsChange?.({ score: gameState.score, moves: gameState.moves, timer });
    onActionsChange?.({
      newGame,
      toggleTimer,
      autoComplete
    });
  }, [gameState.score, gameState.moves, timer, onStatsChange, onActionsChange, newGame, toggleTimer, autoComplete]);

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
          // Remove cards from source - Fixed logic
          if (prev.selectedPile !== null) {
            // Remove from tableau pile
            newState.tableau[prev.selectedPile] = prev.tableau[prev.selectedPile].slice(0, -targetCards.length);
            // Flip top card if it exists and is face down
            const remainingPile = newState.tableau[prev.selectedPile];
            if (remainingPile.length > 0 && !remainingPile[remainingPile.length - 1].faceUp) {
              remainingPile[remainingPile.length - 1].faceUp = true;
            }
          } else {
            // Remove from waste pile - ensure we only remove if it's the selected card
            if (prev.waste.length > 0 && targetCards.length === 1 && 
                prev.waste[prev.waste.length - 1].id === targetCards[0].id) {
              newState.waste = prev.waste.slice(0, -1);
            }
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
        // Select new cards - only allow selection of moveable cards
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

  const renderCard = (card: Card, isSelected: boolean = false) => {
    const isRed = COLORS[card.suit] === 'red';
    
    return (
      <div 
        className={`
          w-16 h-20 sm:w-20 sm:h-24 md:w-22 md:h-26 rounded-xl 
          border-2 border-blue-700 dark:border-blue-400
          flex flex-col items-center justify-center text-sm sm:text-base font-bold
          transition-all duration-300 cursor-pointer relative
          shadow-lg hover:shadow-xl active:scale-95
          ${card.faceUp 
            ? `bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-600 
               ${isRed ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`
            : `bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 
               dark:from-blue-700 dark:via-blue-600 dark:to-blue-500
               text-white border-blue-600 dark:border-blue-300
               shadow-[0_0_20px_rgba(37,99,235,0.5)] dark:shadow-[0_0_25px_rgba(96,165,250,0.6)]`
          }
          ${isSelected ? 'ring-4 ring-blue-500 dark:ring-blue-300 shadow-[0_0_30px_rgba(37,99,235,0.8)] scale-105 z-10' : 'hover:scale-105'}
        `}
      >
        {card.faceUp ? (
          <>
            <span className="text-xs sm:text-sm leading-none font-black">{card.face}</span>
            <span className="text-lg sm:text-xl leading-none">{SUITS[card.suit]}</span>
          </>
        ) : (
          <div className="w-full h-full rounded-xl flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 dark:from-blue-700 dark:via-blue-600 dark:to-blue-500"></div>
            <span 
              className="text-2xl sm:text-3xl font-black relative z-10 text-white
                         shadow-[0_0_15px_rgba(255,255,255,0.8)] dark:shadow-[0_0_20px_rgba(255,255,255,0.9)]
                         animate-pulse"
              style={{
                textShadow: `
                  0 0 10px rgba(255,255,255,0.8),
                  0 0 20px rgba(96,165,250,0.6),
                  0 0 30px rgba(37,99,235,0.4)
                `
              }}
            >
              W
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3 sm:space-y-4 relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 rounded-xl p-2 sm:p-4">
      {/* Game Board */}
      <div className="flex-1 space-y-2 sm:space-y-3">
        {/* Top Row: Stock, Waste, and Foundations */}
        <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
          {/* Stock and Waste - Left */}
          <div className="flex gap-2 sm:gap-3">
            <div 
              className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border-2 border-dashed border-blue-400 dark:border-blue-300 
                         flex items-center justify-center cursor-pointer hover:border-blue-600 dark:hover:border-blue-200 
                         transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30
                         hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              onClick={drawFromStock}
            >
              {gameState.stock.length > 0 ? renderCard(gameState.stock[0]) : (
                <span className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 font-semibold text-center">
                  {language === 'ar' ? 'المخزون' : 'Stock'}
                </span>
              )}
            </div>
            <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border-2 border-blue-700 dark:border-blue-400 
                           flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30
                           shadow-lg">
              {gameState.waste.length > 0 ? (
                <div onClick={() => selectCard(gameState.waste[gameState.waste.length - 1], 'waste')}>
                  {renderCard(gameState.waste[gameState.waste.length - 1], 
                    gameState.selectedCards.length > 0 && 
                    gameState.selectedCards[0].id === gameState.waste[gameState.waste.length - 1]?.id
                  )}
                </div>
              ) : (
                <span className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 font-semibold text-center">
                  {language === 'ar' ? 'المهملات' : 'Waste'}
                </span>
              )}
            </div>
          </div>

          {/* Foundations - Center */}
          <div className="flex gap-1 sm:gap-2 justify-center">
            {Object.entries(SUITS).map(([suit, symbol]) => (
              <div 
                key={suit}
                className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border-2 border-blue-700 dark:border-blue-400 
                           flex items-center justify-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 
                           transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30
                           hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
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
                  <span className={`text-2xl sm:text-3xl font-bold 
                    ${suit === 'hearts' || suit === 'diamonds' 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-gray-700 dark:text-gray-300'
                    }`}>
                    {symbol}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Empty space for balance - Right */}
          <div className="w-32 sm:w-40"></div>
        </div>

        {/* Tableau */}
        <div className="flex gap-1 sm:gap-2 justify-center overflow-x-auto pb-2">
          {gameState.tableau.map((pile, pileIndex) => (
            <div 
              key={pileIndex}
              className="flex flex-col gap-1 min-h-20 sm:min-h-24 w-16 sm:w-20 flex-shrink-0"
              onClick={() => pile.length === 0 && selectEmptySpace('tableau', pileIndex)}
            >
              {pile.length === 0 ? (
                <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl border-2 border-dashed border-blue-400 dark:border-blue-300 
                               cursor-pointer hover:border-blue-600 dark:hover:border-blue-200 transition-all duration-300 
                               bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30
                               hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl" />
              ) : (
                pile.map((card, cardIndex) => (
                  <div 
                    key={card.id}
                    className={`${cardIndex > 0 ? '-mt-10 sm:-mt-12' : ''} relative hover:z-20 transition-all duration-200`}
                    style={{ zIndex: cardIndex }}
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

      {/* Bottom Stats */}
      <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 
                      bg-gradient-to-r from-blue-900/90 to-blue-800/90 dark:from-blue-700/90 dark:to-blue-600/90 
                      backdrop-blur-md rounded-xl px-3 py-2 sm:px-4 sm:py-3 
                      border border-blue-600 dark:border-blue-400 shadow-2xl
                      shadow-[0_0_20px_rgba(37,99,235,0.4)] dark:shadow-[0_0_25px_rgba(96,165,250,0.5)]">
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-bold text-white">
          <span className="flex items-center gap-1">
            <span className="text-yellow-300">🏆</span>
            {language === 'ar' ? 'النقاط' : 'Score'}: {gameState.score}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-blue-300">🎯</span>
            {language === 'ar' ? 'الحركات' : 'Moves'}: {gameState.moves}
          </span>
          <span className="flex items-center gap-1">
            <span className="text-green-300">⏱️</span>
            {Math.floor(timer / 60).toString().padStart(2, '0')}:{(timer % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Win Message */}
      {gameState.gameWon && (
        <div className="absolute inset-4 flex items-center justify-center z-50">
          <div className="text-center p-6 sm:p-8 
                          bg-gradient-to-br from-emerald-500/95 via-green-500/95 to-teal-500/95 
                          dark:from-emerald-600/95 dark:via-green-600/95 dark:to-teal-600/95
                          rounded-2xl border-2 border-emerald-400 dark:border-emerald-300 
                          shadow-2xl backdrop-blur-md
                          shadow-[0_0_40px_rgba(16,185,129,0.6)] dark:shadow-[0_0_50px_rgba(52,211,153,0.7)]
                          animate-fade-in">
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2 sm:mb-3">
              {language === 'ar' ? '🎉 مبروك!' : '🎉 Congratulations!'}
            </h3>
            <p className="text-sm sm:text-base text-emerald-50 font-semibold">
              {language === 'ar' ? 'النتيجة النهائية' : 'Final Score'}: <span className="text-yellow-200 font-bold">{gameState.score}</span>
            </p>
            <p className="text-sm sm:text-base text-emerald-50 font-semibold">
              {language === 'ar' ? 'الوقت' : 'Time'}: <span className="text-yellow-200 font-bold">{formatTime(timer)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
