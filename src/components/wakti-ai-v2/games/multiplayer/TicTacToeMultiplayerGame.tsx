import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Loader2, Trophy } from 'lucide-react';
import { MultiplayerQuickChat, PresetGameMessageKey } from './MultiplayerQuickChat';
import { MultiplayerScoreboard } from './MultiplayerScoreboard';
import { OpponentLeftDialog } from './OpponentLeftDialog';
import {
  TicTacToeMultiplayerService,
  TttGameRow,
  TttMessageRow,
  TttSymbol,
} from '@/services/TicTacToeMultiplayerService';

interface Props {
  code: string;
  onLeave: () => void;
  onRematch: (newCode: string) => void;
  score: { me: number; other: number };
  onGameResolved: (gameCode: string, result: 'me' | 'other' | 'draw') => void;
  onRegisterLeaveHandler?: (handler: (() => Promise<void>) | null) => void;
}

/**
 * Live multiplayer Tic-Tac-Toe game.
 * - Subscribes to realtime UPDATEs on the game row.
 * - Sends moves via INSERT into tictactoe_moves.
 * - Server-side triggers validate moves and apply board state.
 */
export function TicTacToeMultiplayerGame({ code, onLeave, onRematch, score, onGameResolved, onRegisterLeaveHandler }: Props) {
  const { language } = useTheme();
  const { user, session } = useAuth();
  const isAr = language === 'ar';

  const [game, setGame] = useState<TttGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematching, setRematching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [opponentLeftOpen, setOpponentLeftOpen] = useState(false);
  const [messages, setMessages] = useState<TttMessageRow[]>([]);
  const [sendingMessageValue, setSendingMessageValue] = useState<PresetGameMessageKey | null>(null);
  const resolvedGameRef = useRef<string | null>(null);
  const shouldNotifyLeaveRef = useRef(false);

  // Initial load + realtime subscribe
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMessages([]);
    resolvedGameRef.current = null;

    TicTacToeMultiplayerService.fetchGame(code)
      .then((g) => { if (!cancelled) { setGame(g); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e?.message || e)); setLoading(false); } });

    TicTacToeMultiplayerService.fetchMessages(code)
      .then((rows) => { if (!cancelled) setMessages(rows); })
      .catch(() => {});

    const unsubscribe = TicTacToeMultiplayerService.subscribeToGame(code, (row) => {
      setGame(row);
      // If either player kicks off a rematch, switch the whole component to the new code.
      if (row.rematch_code) {
        onRematch(row.rematch_code);
      }
    });

    const unsubscribeMessages = TicTacToeMultiplayerService.subscribeToMessages(code, (row) => {
      setMessages((prev) => (prev.some((message) => message.id === row.id) ? prev : [...prev.slice(-7), row]));
    });

    // Light polling fallback every 2s in case realtime drops a beat (matches Letters pattern)
    const poll = setInterval(async () => {
      try {
        const g = await TicTacToeMultiplayerService.fetchGame(code);
        if (!cancelled && g) setGame(g);
      } catch { /* ignore */ }
    }, 2000);

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeMessages();
      clearInterval(poll);
    };
  }, [code, onRematch]);

  useEffect(() => {
    if (!game || !user?.id || leaving) return;
    if (
      game.status === 'abandoned'
      && game.result_reason === 'player_left'
      && !!game.abandoned_by_user_id
      && game.abandoned_by_user_id !== user.id
    ) {
      setOpponentLeftOpen(true);
    }
  }, [game, user?.id, leaving]);

  useEffect(() => {
    shouldNotifyLeaveRef.current = !!(
      game
      && user?.id
      && game.status === 'playing'
      && !leaving
      && !rematching
      && !game.rematch_code
      && !(game.result_reason === 'player_left' && game.abandoned_by_user_id && game.abandoned_by_user_id !== user.id)
    );
  }, [game, leaving, rematching, user?.id]);

  useEffect(() => {
    return () => {
      if (!shouldNotifyLeaveRef.current || !session?.access_token) return;
      TicTacToeMultiplayerService.notifyLeaveOnExit(code, session.access_token);
    };
  }, [code, session?.access_token]);

  useEffect(() => {
    if (!onRegisterLeaveHandler) return;

    onRegisterLeaveHandler(async () => {
      const currentGame = game;
      if (!currentGame || leaving) {
        onLeave();
        return;
      }

      if (['host_won', 'guest_won', 'draw', 'abandoned'].includes(currentGame.status)) {
        onLeave();
        return;
      }

      setLeaving(true);
      shouldNotifyLeaveRef.current = false;

      try {
        await TicTacToeMultiplayerService.leaveGame(code);
        onLeave();
      } catch (e: any) {
        setLeaving(false);
        toast.error(e?.message || (isAr ? 'تعذر مغادرة اللعبة' : 'Could not leave the game'));
        throw e;
      }
    });

    return () => {
      onRegisterLeaveHandler(null);
    };
  }, [code, game, isAr, leaving, onLeave, onRegisterLeaveHandler]);

  useEffect(() => {
    if (!game || !user?.id) return;
    if (!['host_won', 'guest_won', 'draw', 'abandoned'].includes(game.status)) return;
    if (resolvedGameRef.current === code) return;

    const result: 'me' | 'other' | 'draw' = !game.winner_user_id
      ? 'draw'
      : game.winner_user_id === user.id
        ? 'me'
        : 'other';

    onGameResolved(code, result);
    resolvedGameRef.current = code;
  }, [code, game, onGameResolved, user?.id]);

  const mySymbol: TttSymbol | null = useMemo(() => {
    if (!game || !user?.id) return null;
    if (user.id === game.host_user_id) return game.host_symbol;
    if (user.id === game.guest_user_id) return game.host_symbol === 'X' ? 'O' : 'X';
    return null;
  }, [game, user?.id]);

  const myName = useMemo(() => {
    if (!game || !user?.id) return isAr ? 'أنت' : 'You';
    if (user.id === game.host_user_id) return game.host_name || (isAr ? 'أنت' : 'You');
    if (user.id === game.guest_user_id) return game.guest_name || (isAr ? 'أنت' : 'You');
    return isAr ? 'أنت' : 'You';
  }, [game, isAr, user?.id]);

  const opponentName = useMemo(() => {
    if (!game || !user?.id) return isAr ? 'الخصم' : 'Opponent';
    if (user.id === game.host_user_id) return game.guest_name || (isAr ? 'الخصم' : 'Opponent');
    if (user.id === game.guest_user_id) return game.host_name || (isAr ? 'الخصم' : 'Opponent');
    return isAr ? 'الخصم' : 'Opponent';
  }, [game, isAr, user?.id]);

  const isMyTurn = !!game && !!mySymbol && game.status === 'playing' && game.current_turn === mySymbol;
  const moveCount = useMemo(() => (game?.board || []).filter((c) => c !== null).length, [game]);

  async function handleCellClick(index: number) {
    if (!game || !user?.id || !mySymbol) return;
    if (!isMyTurn) return;
    if (game.board[index] != null) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await TicTacToeMultiplayerService.makeMove({
        code,
        userId: user.id,
        symbol: mySymbol,
        cellIndex: index,
        moveNo: moveCount + 1,
      });
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر تنفيذ الحركة' : 'Move failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRematch() {
    if (!game) return;
    setRematching(true);
    shouldNotifyLeaveRef.current = false;
    try {
      const newCode = await TicTacToeMultiplayerService.rematch(code);
      // The DB also stamps rematch_code on the old row, so the realtime handler
      // above will fire onRematch for both players. Calling it directly here too
      // makes the host transition snappier (no realtime round-trip wait).
      onRematch(newCode);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر بدء لعبة جديدة' : 'Rematch failed'));
    } finally {
      setRematching(false);
    }
  }

  async function handleLeaveGame() {
    shouldNotifyLeaveRef.current = false;
    setLeaving(true);
    try {
      await TicTacToeMultiplayerService.leaveGame(code);
      onLeave();
    } catch (e: any) {
      setLeaving(false);
      toast.error(e?.message || (isAr ? 'تعذر مغادرة اللعبة' : 'Could not leave the game'));
    }
  }

  async function handleSendPresetMessage(messageKey: PresetGameMessageKey) {
    if (!user?.id || sendingMessageValue) return;
    setSendingMessageValue(messageKey);
    try {
      const row = await TicTacToeMultiplayerService.sendMessage(code, user.id, { messageKey });
      setMessages((prev) => (prev.some((message) => message.id === row.id) ? prev : [...prev.slice(-7), row]));
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر إرسال الرسالة' : 'Could not send message'));
    } finally {
      setSendingMessageValue(null);
    }
  }

  function getSenderName(senderUserId: string) {
    if (!game) return senderUserId === user?.id ? myName : opponentName;
    if (senderUserId === game.host_user_id) return game.host_name || (senderUserId === user?.id ? myName : opponentName);
    if (senderUserId === game.guest_user_id) return game.guest_name || (senderUserId === user?.id ? myName : opponentName);
    return senderUserId === user?.id ? myName : opponentName;
  }

  function copyCode() {
    navigator.clipboard.writeText(code).catch(() => {});
    toast.success(isAr ? 'تم نسخ الرمز' : 'Code copied');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (error || !game) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-red-500">{error || (isAr ? 'تعذر تحميل اللعبة' : 'Could not load game')}</p>
        <Button variant="outline" onClick={onLeave}>{isAr ? 'رجوع' : 'Back'}</Button>
      </div>
    );
  }

  const isFinished = ['host_won', 'guest_won', 'draw', 'abandoned'].includes(game.status);
  const showRematch = isFinished && game.result_reason !== 'player_left';
  const iWon =
    (game.status === 'host_won' && user?.id === game.host_user_id) ||
    (game.status === 'guest_won' && user?.id === game.guest_user_id);
  const iLost =
    (game.status === 'host_won' && user?.id === game.guest_user_id) ||
    (game.status === 'guest_won' && user?.id === game.host_user_id);

  const statusText = (() => {
    if (game.status === 'waiting') return isAr ? 'بانتظار انضمام صديقك…' : 'Waiting for your friend to join…';
    if (game.status === 'draw') return isAr ? 'تعادل!' : "It's a draw!";
    if (game.status === 'abandoned' && game.result_reason === 'player_left') {
      return isAr ? `غادر ${opponentName} اللعبة` : `${opponentName} left the game`;
    }
    if (game.status === 'abandoned') return isAr ? 'تم إنهاء اللعبة' : 'Game ended';
    if (iWon) return isAr ? 'فوز! 🎉' : 'You won! 🎉';
    if (iLost) return isAr ? 'الخسارة هذه المرة' : 'You lost — better luck next time';
    if (isMyTurn) return isAr ? 'دورك' : 'Your turn';
    return isAr ? `دور ${opponentName}` : `${opponentName}'s turn`;
  })();

  return (
    <div className="space-y-3 select-none">
      <OpponentLeftDialog
        open={opponentLeftOpen}
        language={language}
        gameName="Tic-Tac-Toe"
        onAcknowledge={() => {
          setOpponentLeftOpen(false);
          onLeave();
        }}
      />

      <div className="mx-auto max-w-md rounded-2xl border border-[#E9CEB0]/40 bg-gradient-to-br from-white via-[#fbfdff] to-[#eef7ff] p-3 shadow-[0_8px_24px_rgba(6,5,65,0.12)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#161824] dark:to-[#0f1118] dark:shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#060541]/70 dark:text-white/65">
              <span>{isAr ? 'الرمز' : 'Code'}:</span>
              <span className="font-mono tracking-wider text-[#060541] dark:text-white">{code}</span>
              <button
                onClick={copyCode}
                className="inline-flex items-center align-middle text-blue-600 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                aria-label="copy"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white">
              {iWon && <Trophy className="h-4 w-4 text-amber-500" />}
              <span className="truncate">{statusText}</span>
            </p>
          </div>
          <div className="text-right text-[12px] text-[#060541]/65 dark:text-white/60">
            <div className="truncate">{myName}: <span className="font-semibold text-[#060541] dark:text-white">{mySymbol ?? '—'}</span></div>
            <div className="truncate">{opponentName}</div>
          </div>
        </div>

        <div className="mt-2">
          <MultiplayerScoreboard
            language={language}
            leftName={myName}
            leftScore={score.me}
            rightName={opponentName}
            rightScore={score.other}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {game.board.map((cell, index) => {
          const isWinningCell = !!game.winning_line?.includes(index);
          const disabled =
            !!cell || isFinished || !isMyTurn || submitting || game.status !== 'playing';
          return (
            <Button
              key={index}
              variant="outline"
              className={[
                'h-20 w-20 text-3xl font-bold transition-all duration-200 active:scale-95',
                'select-none touch-manipulation',
                isWinningCell ? 'ring-2 ring-emerald-400 dark:ring-emerald-500' : '',
              ].join(' ')}
              onTouchStart={() => handleCellClick(index)}
              onClick={() => handleCellClick(index)}
              disabled={disabled}
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              {cell ?? ''}
            </Button>
          );
        })}
      </div>

      <div className="max-w-md mx-auto pt-1">
        <MultiplayerQuickChat
          language={language}
          currentUserId={user?.id}
          messages={messages}
          sendingValue={sendingMessageValue}
          disabled={!user?.id || !game.guest_user_id || leaving}
          onSendPreset={handleSendPresetMessage}
          getSenderName={getSenderName}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto pt-1">
        {showRematch && (
          <Button onClick={handleRematch} disabled={rematching} className="flex-1 min-h-[44px]">
            {rematching ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إعادة المباراة' : 'Rematch')}
          </Button>
        )}
        <Button variant="outline" onClick={handleLeaveGame} className="flex-1 min-h-[44px]">
          {isAr ? 'مغادرة' : 'Leave'}
        </Button>
      </div>
    </div>
  );
}
