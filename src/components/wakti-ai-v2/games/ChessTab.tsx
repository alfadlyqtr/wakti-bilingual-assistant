import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { Bot, Users } from 'lucide-react';
import { ChessGame } from './ChessGame';
import { ChessLobby } from './multiplayer/ChessLobby';
import { ChessMultiplayerGame } from './multiplayer/ChessMultiplayerGame';

type Screen =
  | { kind: 'modePicker' }
  | { kind: 'ai' }
  | { kind: 'lobby' }
  | { kind: 'play'; code: string };

export function ChessTab({ onBack }: { onBack: () => void }) {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [screen, setScreen] = useState<Screen>({ kind: 'modePicker' });

  if (screen.kind === 'modePicker') {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold">{isAr ? 'اختر طريقة اللعب' : 'Choose game mode'}</h3>
          <p className="text-xs text-slate-500">
            {isAr ? 'العب ضد الذكاء الاصطناعي أو مع صديق' : 'Play against AI or with a friend'}
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
    return <ChessGame onBack={() => setScreen({ kind: 'modePicker' })} />;
  }

  if (screen.kind === 'lobby') {
    return (
      <ChessLobby
        onEnterGame={(code) => setScreen({ kind: 'play', code })}
        onCancel={() => setScreen({ kind: 'modePicker' })}
      />
    );
  }

  return (
    <ChessMultiplayerGame
      code={screen.code}
      onLeave={() => setScreen({ kind: 'lobby' })}
      onRematch={(newCode) => setScreen({ kind: 'play', code: newCode })}
    />
  );
}
