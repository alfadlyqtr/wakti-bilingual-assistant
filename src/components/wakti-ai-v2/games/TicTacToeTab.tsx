import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { Bot, Users } from 'lucide-react';
import { TicTacToeGame } from './TicTacToeGame';
import { TicTacToeLobby } from './multiplayer/TicTacToeLobby';
import { TicTacToeMultiplayerGame } from './multiplayer/TicTacToeMultiplayerGame';

type Screen =
  | { kind: 'modePicker' }
  | { kind: 'ai' }
  | { kind: 'lobby' }
  | { kind: 'play'; code: string };

/**
 * Top-level wrapper for the Tic-Tac-Toe tab.
 * Lets the user choose between Play vs AI (existing behavior) or Play vs Friend (new multiplayer flow).
 */
export function TicTacToeTab({ onBack }: { onBack: () => void }) {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [screen, setScreen] = useState<Screen>({ kind: 'modePicker' });

  if (screen.kind === 'modePicker') {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold">{isAr ? 'اختر طريقة اللعب' : 'Choose game mode'}</h3>
          <p className="text-xs text-slate-500">
            {isAr ? 'العب ضد الذكاء الاصطناعي أو ضد صديق' : 'Play against AI or with a friend'}
          </p>
        </div>

        <Button
          onClick={() => setScreen({ kind: 'ai' })}
          className="w-full min-h-[56px] flex items-center justify-center gap-2 text-base"
        >
          <Bot className="h-5 w-5" />
          {isAr ? 'اللعب ضد الذكاء الاصطناعي' : 'Play vs AI'}
        </Button>

        <Button
          onClick={() => setScreen({ kind: 'lobby' })}
          variant="outline"
          className="w-full min-h-[56px] flex items-center justify-center gap-2 text-base border-2"
        >
          <Users className="h-5 w-5" />
          {isAr ? 'اللعب مع صديق' : 'Play with a friend'}
        </Button>

        <Button onClick={onBack} variant="ghost" className="w-full min-h-[40px] text-xs">
          {isAr ? 'رجوع' : 'Back'}
        </Button>
      </div>
    );
  }

  if (screen.kind === 'ai') {
    return <TicTacToeGame onBack={() => setScreen({ kind: 'modePicker' })} />;
  }

  if (screen.kind === 'lobby') {
    return (
      <TicTacToeLobby
        onEnterGame={(code) => setScreen({ kind: 'play', code })}
        onCancel={() => setScreen({ kind: 'modePicker' })}
      />
    );
  }

  // screen.kind === 'play'
  return (
    <TicTacToeMultiplayerGame
      code={screen.code}
      onLeave={() => setScreen({ kind: 'lobby' })}
    />
  );
}
