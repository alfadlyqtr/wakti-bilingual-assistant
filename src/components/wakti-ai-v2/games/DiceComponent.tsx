
import React from 'react';
import { cn } from '@/lib/utils';

interface DiceComponentProps {
  value: number;
  isRolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  language: string;
}

export function DiceComponent({ value, isRolling, onRoll, disabled, language }: DiceComponentProps) {
  // Calculate the sprite position for the dice value (assuming 6 dice faces in a row)
  const getDicePosition = (diceValue: number) => {
    const spriteWidth = 100; // Assuming each dice face is 100px wide
    const x = (diceValue - 1) * spriteWidth;
    return `${x}px`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        className={cn(
          "w-16 h-16 cursor-pointer transition-all duration-300 rounded-lg shadow-lg",
          disabled && "opacity-50 cursor-not-allowed",
          isRolling && "animate-spin"
        )}
        onClick={!disabled ? onRoll : undefined}
      >
        {isRolling ? (
          <img 
            src="/lovable-uploads/diceRoll.png" 
            alt="Rolling dice"
            className="w-full h-full object-contain animate-spin"
          />
        ) : (
          <div 
            className="w-full h-full bg-white rounded-lg shadow-md"
            style={{
              backgroundImage: `url(/lovable-uploads/diceValues.png)`,
              backgroundPosition: `-${getDicePosition(value)} 0px`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '600px 100px' // Assuming 6 dice faces of 100px each
            }}
          />
        )}
      </div>
      <span className="text-xs text-center text-slate-600 dark:text-slate-400">
        {disabled ? 
          (language === 'ar' ? 'انتظر دورك' : 'Wait your turn') : 
          (language === 'ar' ? 'انقر للرمي' : 'Tap to roll')
        }
      </span>
    </div>
  );
}
