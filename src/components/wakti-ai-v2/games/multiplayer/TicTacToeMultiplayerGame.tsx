import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Loader2, Trophy } from 'lucide-react';
import {
  TicTacToeMultiplayerService,
  TttGameRow,
  TttSymbol,
} from '@/services/TicTacToeMultiplayerService';

interface Props {
  code: string;
  onLeave: () => void;
  onRematch: (newCode: string) => void;
}

/**
 * Live multiplayer Tic-Tac-Toe game.
 * - Subscribes to realtime UPDATEs on the game row.
 * - Sends moves via INSERT into tictactoe_moves.
 * - Server-side triggers validate moves and apply board state.
 */
export function TicTacToeMultiplayerGame({ code, onLeave, onRematch }: Props) {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const [game, setGame] = useState<TttGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematching, setRematching] = useState(false);

  // Initial load + realtime subscribe
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    TicTacToeMultiplayerService.fetchGame(code)
      .then((g) => { if (!cancelled) { setGame(g); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e?.message || e)); setLoading(false); } });

    const unsubscribe = TicTacToeMultiplayerService.subscribeToGame(code, (row) => {
      setGame(row);
      // If either player kicks off a rematch, switch the whole component to the new code.
      if (row.rematch_code) {
        onRematch(row.rematch_code);
      }
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
      clearInterval(poll);
    };
  }, [code]);

  const mySymbol: TttSymbol | null = useMemo(() => {
    if (!game || !user?.id) return null;
    if (user.id === game.host_user_id) return game.host_symbol;
    if (user.id === game.guest_user_id) return game.host_symbol === 'X' ? 'O' : 'X';
    return null;
  }, [game, user?.id]);

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
  const iWon =
    (game.status === 'host_won' && user?.id === game.host_user_id) ||
    (game.status === 'guest_won' && user?.id === game.guest_user_id);
  const iLost =
    (game.status === 'host_won' && user?.id === game.guest_user_id) ||
    (game.status === 'guest_won' && user?.id === game.host_user_id);

  const statusText = (() => {
    if (game.status === 'waiting') return isAr ? 'بانتظار اللاعب الآخر…' : 'Waiting for opponent…';
    if (game.status === 'draw') return isAr ? 'تعادل!' : "It's a draw!";
    if (game.status === 'abandoned') return isAr ? 'تم التخلي عن اللعبة' : 'Game abandoned';
    if (iWon) return isAr ? 'فوز! 🎉' : 'You won! 🎉';
    if (iLost) return isAr ? 'الخسارة هذه المرة' : 'You lost — better luck next time';
    if (isMyTurn) return isAr ? 'دورك' : 'Your turn';
    return isAr ? 'دور الخصم' : "Opponent's turn";
  })();

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="text-sm font-medium">
          <span className="text-slate-500">{isAr ? 'الرمز' : 'Code'}: </span>
          <span className="font-mono tracking-wider">{code}</span>
          <button
            onClick={copyCode}
            className="ml-2 inline-flex items-center align-middle text-indigo-600 hover:text-indigo-700"
            aria-label="copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="text-xs text-slate-500">
          {isAr ? 'أنت' : 'You'}: <span className="font-bold">{mySymbol ?? '—'}</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-base font-semibold flex items-center justify-center gap-2">
          {iWon && <Trophy className="h-4 w-4 text-amber-500" />}
          {statusText}
        </p>
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

      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
        {isFinished && (
          <Button onClick={handleRematch} disabled={rematching} className="flex-1 min-h-[44px]">
            {rematching ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إعادة المباراة' : 'Rematch')}
          </Button>
        )}
        <Button variant="outline" onClick={onLeave} className="flex-1 min-h-[44px]">
          {isAr ? 'مغادرة' : 'Leave'}
        </Button>
      </div>
    </div>
  );
}
