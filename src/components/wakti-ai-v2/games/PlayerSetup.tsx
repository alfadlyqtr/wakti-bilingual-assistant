
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/ThemeProvider';

interface PlayerSetupProps {
  gameMode: '1v3' | '2v2' | '3v1' | '4human' | '1v1';
  onSetupComplete: (playerNames: Record<string, string>) => void;
  onBack: () => void;
}

export function PlayerSetup({ gameMode, onSetupComplete, onBack }: PlayerSetupProps) {
  const { language } = useTheme();
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});

  const getHumanPlayersForMode = (mode: string) => {
    switch (mode) {
      case '1v3': return ['blue'];
      case '2v2': return ['blue', 'green'];
      case '3v1': return ['blue', 'red', 'green'];
      case '4human': return ['blue', 'red', 'green', 'yellow'];
      case '1v1': return ['blue', 'red'];
      default: return ['blue'];
    }
  };

  const humanPlayers = getHumanPlayersForMode(gameMode);

  const handleNameChange = (color: string, name: string) => {
    setPlayerNames(prev => ({
      ...prev,
      [color]: name
    }));
  };

  const handleStartGame = () => {
    // Ensure all human players have names
    const finalNames: Record<string, string> = {};
    humanPlayers.forEach(color => {
      finalNames[color] = playerNames[color] || `Player ${color}`;
    });
    
    onSetupComplete(finalNames);
  };

  const getColorName = (color: string) => {
    const names = {
      blue: language === 'ar' ? 'أزرق' : 'Blue',
      red: language === 'ar' ? 'أحمر' : 'Red', 
      green: language === 'ar' ? 'أخضر' : 'Green',
      yellow: language === 'ar' ? 'أصفر' : 'Yellow'
    };
    return names[color as keyof typeof names] || color;
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">
          {language === 'ar' ? 'إعداد اللاعبين' : 'Player Setup'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {language === 'ar' ? 'أدخل أسماء اللاعبين' : 'Enter player names'}
        </p>
      </div>

      <div className="space-y-4">
        {humanPlayers.map(color => (
          <div key={color} className="space-y-2">
            <Label htmlFor={`player-${color}`} className="flex items-center space-x-2">
              <div className={cn(
                "w-6 h-6 rounded-full border-2 border-white",
                color === 'blue' && "bg-blue-600",
                color === 'red' && "bg-red-600",
                color === 'green' && "bg-green-600", 
                color === 'yellow' && "bg-yellow-500"
              )}></div>
              <span>{getColorName(color)}</span>
            </Label>
            <Input
              id={`player-${color}`}
              type="text"
              placeholder={language === 'ar' ? 'اسم اللاعب' : 'Player name'}
              value={playerNames[color] || ''}
              onChange={(e) => handleNameChange(color, e.target.value)}
              className="w-full"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-8">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1"
        >
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
        <Button
          onClick={handleStartGame}
          className="flex-1"
        >
          {language === 'ar' ? 'بدء اللعبة' : 'Start Game'}
        </Button>
      </div>
    </div>
  );
}
