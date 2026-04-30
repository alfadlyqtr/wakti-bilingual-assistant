import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Grid3x3, UserPlus, Send } from 'lucide-react';
import { GameInvitePickerDialog } from '@/components/games/GameInvitePickerDialog';
import { TicTacToeMultiplayerService, TttSymbol } from '@/services/TicTacToeMultiplayerService';

interface Props {
  onEnterGame: (code: string) => void;
  onCancel: () => void;
}

/**
 * Lobby for multiplayer Tic-Tac-Toe.
 * Two paths: create a game (get a code) or join an existing one (enter code).
 */
export function TicTacToeLobby({ onEnterGame, onCancel }: Props) {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const defaultName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split('@')[0] ||
    (isAr ? 'لاعب' : 'Player');

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState<string>(defaultName);
  const [symbol, setSymbol] = useState<TttSymbol>('X');
  const [code, setCode] = useState<string>('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!user?.id) {
      toast.error(isAr ? 'يرجى تسجيل الدخول' : 'Please sign in');
      return;
    }
    setBusy(true);
    try {
      const newCode = await TicTacToeMultiplayerService.createGame(name.trim() || defaultName, symbol);
      onEnterGame(newCode);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر إنشاء اللعبة' : 'Could not create game'));
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite() {
    if (!user?.id) {
      toast.error(isAr ? 'يرجى تسجيل الدخول' : 'Please sign in');
      return;
    }
    if (inviteCode) {
      setShowInvitePicker(true);
      return;
    }
    setBusy(true);
    try {
      const newCode = await TicTacToeMultiplayerService.createGame(name.trim() || defaultName, symbol);
      setInviteCode(newCode);
      setShowInvitePicker(true);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر تجهيز الدعوة' : 'Could not prepare invite'));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user?.id) {
      toast.error(isAr ? 'يرجى تسجيل الدخول' : 'Please sign in');
      return;
    }
    const clean = code.trim().toUpperCase();
    if (clean.length !== 4) {
      toast.error(isAr ? 'الرمز يجب أن يكون 4 أحرف' : 'Code must be 4 characters');
      return;
    }
    setBusy(true);
    try {
      await TicTacToeMultiplayerService.joinGame(clean, name.trim() || defaultName);
      onEnterGame(clean);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر الانضمام' : 'Could not join'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'menu') {
    return (
      <>
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-[#E9CEB0]/30 bg-white p-6 shadow-[0_8px_32px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1a1d26] dark:via-[#161921] dark:to-[#11131a] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="mb-6 text-center">
              <div className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-[0_8px_20px_rgba(59,130,246,0.3)]">
                <UserPlus className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#060541] dark:text-white">
                {isAr ? 'اللعب مع صديق' : 'Play with a friend'}
              </h3>
              <p className="mt-1 text-sm text-[#060541]/50 dark:text-white/40">
                {isAr ? 'أنشئ لعبة وشارك الرمز أو انضم برمز صديقك' : 'Create a game and share the code, or join with your friend\'s code'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="group flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 p-4 text-left text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                  <Grid3x3 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold">{isAr ? 'إنشاء لعبة' : 'Create game'}</div>
                  <div className="text-sm text-white/70">{isAr ? 'احصل على رمز وشاركه مع صديقك' : 'Get a code and share it with your friend'}</div>
                </div>
                <svg className="h-5 w-5 text-white/50 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => setMode('join')}
                className="group flex w-full items-center gap-4 rounded-2xl border-2 border-[#E9CEB0]/50 bg-[#E9CEB0]/10 p-4 text-left transition-all duration-200 hover:border-[#E9CEB0]/70 hover:bg-[#E9CEB0]/20 hover:-translate-y-0.5 active:translate-y-0 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/25 dark:hover:bg-white/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#060541]/5 dark:bg-white/10">
                  <svg className="h-6 w-6 text-[#060541] dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-[#060541] dark:text-white">{isAr ? 'الانضمام برمز' : 'Join with code'}</div>
                  <div className="text-sm text-[#060541]/50 dark:text-white/40">{isAr ? 'أدخل رمز صديقك للانضمام' : 'Enter your friend\'s code to join'}</div>
                </div>
                <svg className="h-5 w-5 text-[#060541]/30 transition-transform duration-200 group-hover:translate-x-1 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={onCancel}
                className="w-full rounded-xl py-3 text-sm font-medium text-[#060541]/60 transition-colors hover:text-[#060541] dark:text-white/40 dark:hover:text-white"
              >
                {isAr ? 'رجوع' : 'Back'}
              </button>
            </div>
          </div>
        </div>
        <GameInvitePickerDialog
          isOpen={showInvitePicker}
          gameType="tictactoe"
          gameCode={inviteCode}
          onClose={() => setShowInvitePicker(false)}
          onSent={() => {
            if (inviteCode) {
              onEnterGame(inviteCode);
            }
          }}
        />
      </>
    );
  }

  if (mode === 'create') {
    return (
      <>
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-[#E9CEB0]/30 bg-white p-6 shadow-[0_8px_32px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1a1d26] dark:via-[#161921] dark:to-[#11131a] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="mb-6 text-center">
              <div className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-[0_8px_20px_rgba(59,130,246,0.3)]">
                <Grid3x3 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-[#060541] dark:text-white">
                {isAr ? 'إنشاء لعبة' : 'Create game'}
              </h3>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="mb-2 block text-sm font-medium text-[#060541] dark:text-white">{isAr ? 'اسمك' : 'Your name'}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={32}
                  className="h-12 rounded-xl border-[#E9CEB0]/30 bg-white text-[#060541] placeholder:text-[#060541]/40 focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
                />
              </div>

              <div>
                <Label className="mb-2 block text-sm font-medium text-[#060541] dark:text-white">{isAr ? 'اختر رمزك' : 'Choose your symbol'}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSymbol('X')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-4 text-xl font-bold transition-all ${
                      symbol === 'X'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)]'
                        : 'border-2 border-[#E9CEB0]/50 bg-[#E9CEB0]/10 text-[#060541] hover:border-[#E9CEB0]/70 dark:border-white/15 dark:bg-white/5 dark:text-white'
                    }`}
                  >
                    X
                  </button>
                  <button
                    onClick={() => setSymbol('O')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-4 text-xl font-bold transition-all ${
                      symbol === 'O'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_4px_14px_rgba(59,130,246,0.3)]'
                        : 'border-2 border-[#E9CEB0]/50 bg-[#E9CEB0]/10 text-[#060541] hover:border-[#E9CEB0]/70 dark:border-white/15 dark:bg-white/5 dark:text-white'
                    }`}
                  >
                    O
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-4 text-base font-semibold text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (isAr ? 'إنشاء والدخول إلى اللعبة' : 'Create & enter game')}
              </button>

              <button
                onClick={handleInvite}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/40 bg-[linear-gradient(135deg,rgba(6,5,65,0.04),rgba(34,211,238,0.12))] py-4 text-base font-semibold text-[#060541] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/50 hover:bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(34,211,238,0.18))] disabled:opacity-50 disabled:hover:translate-y-0 dark:border-sky-400/20 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(34,211,238,0.14))] dark:text-white"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {isAr ? 'إنشاء ودعوة جهة اتصال' : 'Create & invite contact'}
              </button>

              <button
                onClick={() => setMode('menu')}
                className="w-full rounded-xl py-3 text-sm font-medium text-[#060541]/60 transition-colors hover:text-[#060541] dark:text-white/40 dark:hover:text-white"
              >
                {isAr ? 'رجوع' : 'Back'}
              </button>
            </div>
          </div>
        </div>
        <GameInvitePickerDialog
          isOpen={showInvitePicker}
          gameType="tictactoe"
          gameCode={inviteCode}
          onClose={() => setShowInvitePicker(false)}
          onSent={() => {
            if (inviteCode) {
              onEnterGame(inviteCode);
            }
          }}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl border border-[#E9CEB0]/30 bg-white p-6 shadow-[0_8px_32px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1a1d26] dark:via-[#161921] dark:to-[#11131a] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="mb-6 text-center">
          <div className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-[0_8px_20px_rgba(59,130,246,0.3)]">
            <UserPlus className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-xl font-bold text-[#060541] dark:text-white">
            {isAr ? 'الانضمام للعبة' : 'Join a game'}
          </h3>
        </div>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block text-sm font-medium text-[#060541] dark:text-white">{isAr ? 'اسمك' : 'Your name'}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="h-12 rounded-xl border-[#E9CEB0]/30 bg-white text-[#060541] placeholder:text-[#060541]/40 focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
            />
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium text-[#060541] dark:text-white">{isAr ? 'رمز اللعبة' : 'Game code'}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="ABCD"
              maxLength={4}
              className="h-14 rounded-xl border-[#E9CEB0]/30 bg-white text-center font-mono text-2xl tracking-[0.5em] text-[#060541] placeholder:text-[#060541]/20 placeholder:tracking-normal focus:border-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/20"
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={busy || code.length !== 4}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 py-4 text-base font-semibold text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)] transition-all duration-200 hover:shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (isAr ? 'انضمام' : 'Join')}
          </button>

          <button
            onClick={() => setMode('menu')}
            className="w-full rounded-xl py-3 text-sm font-medium text-[#060541]/60 transition-colors hover:text-[#060541] dark:text-white/40 dark:hover:text-white"
          >
            {isAr ? 'رجوع' : 'Back'}
          </button>
        </div>
      </div>
    </div>
  );
}
