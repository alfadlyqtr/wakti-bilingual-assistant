import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Bot, Users, Castle } from 'lucide-react';
import { ChessGame } from './ChessGame';
import { ChessLobby } from './multiplayer/ChessLobby';
import { ChessMultiplayerGame } from './multiplayer/ChessMultiplayerGame';
import { GameInvitePickerDialog } from '@/components/games/GameInvitePickerDialog';

type Screen =
  | { kind: 'modePicker' }
  | { kind: 'ai' }
  | { kind: 'lobby' }
  | { kind: 'play'; code: string };

interface ChessTabProps {
  inviteCode?: string | null;
  inviteLaunchToken?: string | null;
  onInviteCodeConsumed?: () => void;
  onRegisterGameExitHandler?: (handler: (() => Promise<void>) | null) => void;
}

export function ChessTab({ inviteCode = null, inviteLaunchToken = null, onInviteCodeConsumed, onRegisterGameExitHandler }: ChessTabProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [screen, setScreen] = useState<Screen>(() => inviteCode ? { kind: 'play', code: inviteCode } : { kind: 'modePicker' });
  const [score, setScore] = useState({ me: 0, other: 0 });
  const scoredGamesRef = useRef<Set<string>>(new Set());
  const consumedInviteTokenRef = useRef<string | null>(null);
  const [invitePickerCode, setInvitePickerCode] = useState<string | null>(null);

  const resetMultiplayerSession = () => {
    setScore({ me: 0, other: 0 });
    scoredGamesRef.current = new Set();
  };

  const handleGameResolved = (gameCode: string, result: 'me' | 'other' | 'draw') => {
    if (scoredGamesRef.current.has(gameCode)) return;
    scoredGamesRef.current.add(gameCode);
    if (result === 'me') {
      setScore((prev) => ({ ...prev, me: prev.me + 1 }));
    } else if (result === 'other') {
      setScore((prev) => ({ ...prev, other: prev.other + 1 }));
    }
  };

  useEffect(() => {
    if (!inviteCode) return;
    if (inviteLaunchToken && consumedInviteTokenRef.current === inviteLaunchToken) return;
    consumedInviteTokenRef.current = inviteLaunchToken;
    resetMultiplayerSession();
    setScreen({ kind: 'play', code: inviteCode });
    onInviteCodeConsumed?.();
  }, [inviteCode, inviteLaunchToken, onInviteCodeConsumed]);

  useEffect(() => {
    if (screen.kind !== 'play') {
      onRegisterGameExitHandler?.(null);
    }
  }, [onRegisterGameExitHandler, screen.kind]);

  if (screen.kind === 'modePicker') {
    return (
      <div className="mx-auto max-w-md space-y-6">
        {/* Mode Picker Card */}
        <div className="rounded-3xl border border-[#E9CEB0]/30 bg-white p-6 shadow-[0_8px_32px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1a1d26] dark:via-[#161921] dark:to-[#11131a] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="mb-6 text-center">
            <div className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-[0_8px_20px_rgba(37,99,235,0.3)]">
              <Castle className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#060541] dark:text-white">
              {isAr ? 'اختر طريقة اللعب' : 'Choose game mode'}
            </h3>
            <p className="mt-1 text-sm text-[#060541]/50 dark:text-white/40">
              {isAr ? 'العب ضد الذكاء الاصطناعي أو مع صديق' : 'Play against AI or with a friend'}
            </p>
          </div>

          <div className="space-y-3">
            {/* AI Button */}
            <button
              onClick={() => setScreen({ kind: 'ai' })}
              className="group flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 p-4 text-left text-white shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(37,99,235,0.4)] hover:-translate-y-0.5 active:translate-y-0"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Bot className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold">{isAr ? 'اللعب ضد الذكاء الاصطناعي' : 'Play vs AI'}</div>
                <div className="text-sm text-white/70">{isAr ? 'مستويات متعددة من الصعوبة' : 'Multiple difficulty levels'}</div>
              </div>
              <svg className="h-5 w-5 text-white/50 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Multiplayer Button */}
            <button
              onClick={() => {
                resetMultiplayerSession();
                setScreen({ kind: 'lobby' });
              }}
              className="group flex w-full items-center gap-4 rounded-2xl border-2 border-[#E9CEB0]/50 bg-[#E9CEB0]/10 p-4 text-left transition-all duration-200 hover:border-[#E9CEB0]/70 hover:bg-[#E9CEB0]/20 hover:-translate-y-0.5 active:translate-y-0 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/25 dark:hover:bg-white/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#060541]/5 dark:bg-white/10">
                <Users className="h-6 w-6 text-[#060541] dark:text-white" />
              </div>
              <div className="flex-1">
                <div className="text-base font-semibold text-[#060541] dark:text-white">{isAr ? 'اللعب مع صديق' : 'Play with a friend'}</div>
                <div className="text-sm text-[#060541]/50 dark:text-white/40">{isAr ? 'أنشئ لعبة أو انضم بواسطة رمز' : 'Create a game or join with a code'}</div>
              </div>
              <svg className="h-5 w-5 text-[#060541]/30 transition-transform duration-200 group-hover:translate-x-1 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen.kind === 'ai') {
    return <ChessGame onBack={() => setScreen({ kind: 'modePicker' })} />;
  }

  if (screen.kind === 'lobby') {
    return (
      <>
        <ChessLobby
          onEnterGame={(code) => setScreen({ kind: 'play', code })}
          onEnterGameWithInvite={(code) => {
            setScreen({ kind: 'play', code });
            setInvitePickerCode(code);
          }}
          onCancel={() => setScreen({ kind: 'modePicker' })}
        />
        <GameInvitePickerDialog
          isOpen={!!invitePickerCode}
          gameType="chess"
          gameCode={invitePickerCode}
          onClose={() => setInvitePickerCode(null)}
          onSent={() => setInvitePickerCode(null)}
        />
      </>
    );
  }

  return (
    <>
    <ChessMultiplayerGame
      code={screen.code}
      score={score}
      onGameResolved={handleGameResolved}
      onRegisterLeaveHandler={onRegisterGameExitHandler}
      onLeave={() => {
        resetMultiplayerSession();
        setScreen({ kind: 'lobby' });
      }}
      onRematch={(newCode) => setScreen({ kind: 'play', code: newCode })}
    />
    <GameInvitePickerDialog
      isOpen={!!invitePickerCode}
      gameType="chess"
      gameCode={invitePickerCode}
      onClose={() => setInvitePickerCode(null)}
      onSent={() => setInvitePickerCode(null)}
    />
    </>
  );
}
