import React, { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Loader2, Trophy } from 'lucide-react';
import { OpponentLeftDialog } from './OpponentLeftDialog';
import { ChessGameRow, ChessMultiplayerService, ChessSide } from '@/services/ChessMultiplayerService';

interface Props {
  code: string;
  onLeave: () => void;
  onRematch: (newCode: string) => void;
}

export function ChessMultiplayerGame({ code, onLeave, onRematch }: Props) {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const [game, setGame] = useState<ChessGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [opponentLeftOpen, setOpponentLeftOpen] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedSquare(null);
    setValidMoves([]);

    ChessMultiplayerService.fetchGame(code)
      .then((g) => {
        if (!cancelled) {
          setGame(g);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e?.message || e));
          setLoading(false);
        }
      });

    const unsubscribe = ChessMultiplayerService.subscribeToGame(code, (row) => {
      setGame(row);
      if (row.rematch_code && row.rematch_code !== code) {
        onRematch(row.rematch_code);
      }
    });

    const poll = setInterval(async () => {
      try {
        const g = await ChessMultiplayerService.fetchGame(code);
        if (!cancelled && g) {
          setGame(g);
          if (g.rematch_code && g.rematch_code !== code) {
            onRematch(g.rematch_code);
          }
        }
      } catch {}
    }, 2000);

    return () => {
      cancelled = true;
      unsubscribe();
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

  const chess = useMemo(() => {
    try {
      return game ? new Chess(game.fen) : null;
    } catch {
      return null;
    }
  }, [game?.fen]);

  const myColor: ChessSide | null = useMemo(() => {
    if (!game || !user?.id) return null;
    if (user.id === game.host_user_id) return game.host_color;
    if (user.id === game.guest_user_id) return game.host_color === 'white' ? 'black' : 'white';
    return null;
  }, [game, user?.id]);

  const opponentName = useMemo(() => {
    if (!game || !user?.id) return null;
    if (user.id === game.host_user_id) return game.guest_name || (isAr ? 'الخصم' : 'Opponent');
    return game.host_name || (isAr ? 'الخصم' : 'Opponent');
  }, [game, user?.id, isAr]);

  const isFinished = !!game && ['host_won', 'guest_won', 'draw', 'abandoned'].includes(game.status);
  const isMyTurn = !!game && !!myColor && game.status === 'playing' && game.current_turn === myColor;

  function sideToPieceColor(side: ChessSide) {
    return side === 'white' ? 'w' : 'b';
  }

  function deriveOutcome(after: Chess, moverColor: ChessSide) {
    if (!after.isGameOver()) {
      return { outcome: 'playing' as const, resultReason: null as string | null };
    }
    if (after.isCheckmate()) {
      return {
        outcome: moverColor === 'white' ? 'white_won' as const : 'black_won' as const,
        resultReason: 'checkmate',
      };
    }
    if (after.isStalemate()) return { outcome: 'draw' as const, resultReason: 'stalemate' };
    if (after.isThreefoldRepetition()) return { outcome: 'draw' as const, resultReason: 'threefold_repetition' };
    if (after.isInsufficientMaterial()) return { outcome: 'draw' as const, resultReason: 'insufficient_material' };
    return { outcome: 'draw' as const, resultReason: 'draw' };
  }

  function clearSelection() {
    setSelectedSquare(null);
    setValidMoves([]);
  }

  async function onSquareClick(square: string) {
    if (!game || !chess || !myColor || !isMyTurn || isFinished || submitting) return;

    const gameCopy = new Chess(chess.fen());
    const piece = gameCopy.get(square as any);
    const myPieceColor = sideToPieceColor(myColor);

    if (!selectedSquare) {
      if (piece && piece.color === myPieceColor) {
        setSelectedSquare(square);
        const moves = gameCopy.moves({ square: square as any, verbose: true });
        setValidMoves(moves.map((move: any) => move.to));
      }
      return;
    }

    if (selectedSquare === square) {
      clearSelection();
      return;
    }

    if (piece && piece.color === myPieceColor) {
      setSelectedSquare(square);
      const moves = gameCopy.moves({ square: square as any, verbose: true });
      setValidMoves(moves.map((move: any) => move.to));
      return;
    }

    try {
      const move = gameCopy.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (!move) return;

      const { outcome, resultReason } = deriveOutcome(gameCopy, myColor);
      setSubmitting(true);
      await ChessMultiplayerService.submitMove({
        code,
        fromSquare: move.from,
        toSquare: move.to,
        promotion: move.promotion || null,
        san: move.san,
        fenAfter: gameCopy.fen(),
        outcome,
        resultReason,
      });
      clearSelection();
    } catch (e: any) {
      clearSelection();
      toast.error(e?.message || (isAr ? 'تعذر تنفيذ الحركة' : 'Move failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRematch() {
    setRematching(true);
    try {
      const newCode = await ChessMultiplayerService.rematch(code);
      onRematch(newCode);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر بدء إعادة المباراة' : 'Rematch failed'));
    } finally {
      setRematching(false);
    }
  }

  async function handleLeaveGame() {
    setLeaving(true);
    try {
      await ChessMultiplayerService.leaveGame(code);
      onLeave();
    } catch (e: any) {
      setLeaving(false);
      toast.error(e?.message || (isAr ? 'تعذر مغادرة اللعبة' : 'Could not leave the game'));
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

  if (error || !game || !chess) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-red-500">{error || (isAr ? 'تعذر تحميل اللعبة' : 'Could not load game')}</p>
        <Button variant="outline" onClick={onLeave}>{isAr ? 'رجوع' : 'Back'}</Button>
      </div>
    );
  }

  const iWon =
    (game.status === 'host_won' && user?.id === game.host_user_id) ||
    (game.status === 'guest_won' && user?.id === game.guest_user_id);
  const iLost =
    (game.status === 'host_won' && user?.id === game.guest_user_id) ||
    (game.status === 'guest_won' && user?.id === game.host_user_id);
  const showRematch = isFinished && game.result_reason !== 'player_left';

  const statusText = (() => {
    if (game.status === 'waiting') return isAr ? 'بانتظار اللاعب الآخر…' : 'Waiting for opponent…';
    if (game.status === 'draw') return isAr ? 'تعادل!' : "It's a draw!";
    if (game.status === 'abandoned') return isAr ? 'تم التخلي عن اللعبة' : 'Game abandoned';
    if (iWon) return isAr ? 'فوز! 🎉' : 'You won! 🎉';
    if (iLost) return isAr ? 'خسرت هذه الجولة' : 'You lost this round';
    if (isMyTurn) return isAr ? 'دورك' : 'Your turn';
    return isAr ? 'دور الخصم' : "Opponent's turn";
  })();

  const reasonText = (() => {
    if (!game.result_reason) return null;
    const map: Record<string, string> = {
      checkmate: isAr ? 'كش مات' : 'Checkmate',
      stalemate: isAr ? 'تعادل - ستالمِيت' : 'Stalemate',
      threefold_repetition: isAr ? 'تعادل - تكرار ثلاثي' : 'Threefold repetition',
      insufficient_material: isAr ? 'تعادل - مواد غير كافية' : 'Insufficient material',
      draw: isAr ? 'تعادل' : 'Draw',
    };
    return map[game.result_reason] || game.result_reason;
  })();

  return (
    <div className="space-y-4 select-none">
      <OpponentLeftDialog
        open={opponentLeftOpen}
        language={language}
        gameName="Chess"
        onAcknowledge={() => {
          setOpponentLeftOpen(false);
          onLeave();
        }}
      />

      <div className="flex items-center justify-between gap-2 px-1 text-sm">
        <div className="font-medium">
          <span className="text-slate-500">{isAr ? 'الرمز' : 'Code'}: </span>
          <span className="font-mono tracking-wider">{code}</span>
          <button onClick={copyCode} className="ml-2 inline-flex items-center text-indigo-600 hover:text-indigo-700" aria-label="copy">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="text-xs text-slate-500">
          {isAr ? 'أنت' : 'You'}: <span className="font-bold">{myColor === 'white' ? (isAr ? 'أبيض' : 'White') : myColor === 'black' ? (isAr ? 'أسود' : 'Black') : '—'}</span>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-base font-semibold flex items-center justify-center gap-2">
          {iWon && <Trophy className="h-4 w-4 text-amber-500" />}
          {statusText}
        </p>
        <p className="text-xs text-slate-500">
          {isAr ? 'الخصم' : 'Opponent'}: {opponentName || (isAr ? 'بانتظار الانضمام' : 'Waiting to join')}
        </p>
        {reasonText && <p className="text-xs text-slate-500">{reasonText}</p>}
      </div>

      <div className="flex justify-center overflow-x-auto">
        <div className="w-full max-w-md">
          <Chessboard
            position={chess.fen()}
            onSquareClick={onSquareClick}
            boardOrientation={myColor || 'white'}
            arePiecesDraggable={false}
            animationDuration={300}
            customSquareStyles={{
              ...(selectedSquare ? { [selectedSquare]: { backgroundColor: 'rgba(255,255,0,0.35)' } } : {}),
              ...validMoves.reduce((acc, square) => ({
                ...acc,
                [square]: { backgroundColor: 'rgba(34,197,94,0.28)' },
              }), {} as Record<string, React.CSSProperties>),
            }}
            customBoardStyle={{
              borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            }}
          />
        </div>
      </div>

      {!isFinished && (
        <div className="text-center text-sm text-slate-600 dark:text-slate-400">
          {game.status === 'waiting'
            ? (isAr ? 'شارك الرمز مع صديقك لينضم.' : 'Share the code so your friend can join.')
            : submitting
              ? (isAr ? 'جارٍ إرسال الحركة...' : 'Sending move...')
              : isMyTurn
                ? (isAr ? 'اضغط القطعة ثم المربع الهدف' : 'Tap the piece, then the destination square')
                : (isAr ? 'بانتظار حركة الخصم' : 'Waiting for opponent move')}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
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
