import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Loader2, Trophy } from 'lucide-react';
import { MultiplayerQuickChat, PresetGameMessageKey } from './MultiplayerQuickChat';
import { MultiplayerScoreboard } from './MultiplayerScoreboard';
import { OpponentLeftDialog } from './OpponentLeftDialog';
import { ChessGameRow, ChessMessageRow, ChessMultiplayerService, ChessSide } from '@/services/ChessMultiplayerService';

interface Props {
  code: string;
  onLeave: () => void;
  onRematch: (newCode: string) => void;
  score: { me: number; other: number };
  onGameResolved: (gameCode: string, result: 'me' | 'other' | 'draw') => void;
  onRegisterLeaveHandler?: (handler: (() => Promise<void>) | null) => void;
}

export function ChessMultiplayerGame({ code, onLeave, onRematch, score, onGameResolved, onRegisterLeaveHandler }: Props) {
  const { language } = useTheme();
  const { user, session } = useAuth();
  const isAr = language === 'ar';

  const [game, setGame] = useState<ChessGameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [opponentLeftOpen, setOpponentLeftOpen] = useState(false);
  const [messages, setMessages] = useState<ChessMessageRow[]>([]);
  const [sendingMessageValue, setSendingMessageValue] = useState<PresetGameMessageKey | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const resolvedGameRef = useRef<string | null>(null);
  const shouldNotifyLeaveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedSquare(null);
    setValidMoves([]);
    setMessages([]);
    resolvedGameRef.current = null;

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

    ChessMultiplayerService.fetchMessages(code)
      .then((rows) => {
        if (!cancelled) {
          setMessages(rows);
        }
      })
      .catch(() => {});

    const unsubscribe = ChessMultiplayerService.subscribeToGame(code, (row) => {
      setGame(row);
      if (row.rematch_code && row.rematch_code !== code) {
        onRematch(row.rematch_code);
      }
    });

    const unsubscribeMessages = ChessMultiplayerService.subscribeToMessages(code, (row) => {
      setMessages((prev) => (prev.some((message) => message.id === row.id) ? prev : [...prev.slice(-7), row]));
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
      ChessMultiplayerService.notifyLeaveOnExit(code, session.access_token);
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
        await ChessMultiplayerService.leaveGame(code);
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

  const myName = useMemo(() => {
    if (!game || !user?.id) return isAr ? 'أنت' : 'You';
    if (user.id === game.host_user_id) return game.host_name || (isAr ? 'أنت' : 'You');
    if (user.id === game.guest_user_id) return game.guest_name || (isAr ? 'أنت' : 'You');
    return isAr ? 'أنت' : 'You';
  }, [game, isAr, user?.id]);

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
    shouldNotifyLeaveRef.current = false;
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
    shouldNotifyLeaveRef.current = false;
    setLeaving(true);
    try {
      await ChessMultiplayerService.leaveGame(code);
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
      const row = await ChessMultiplayerService.sendMessage(code, user.id, { messageKey });
      setMessages((prev) => (prev.some((message) => message.id === row.id) ? prev : [...prev.slice(-7), row]));
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر إرسال الرسالة' : 'Could not send message'));
    } finally {
      setSendingMessageValue(null);
    }
  }

  function getSenderName(senderUserId: string) {
    if (!game) return senderUserId === user?.id ? myName : (opponentName || (isAr ? 'الخصم' : 'Opponent'));
    if (senderUserId === game.host_user_id) return game.host_name || (senderUserId === user?.id ? myName : (opponentName || (isAr ? 'الخصم' : 'Opponent')));
    if (senderUserId === game.guest_user_id) return game.guest_name || (senderUserId === user?.id ? myName : (opponentName || (isAr ? 'الخصم' : 'Opponent')));
    return senderUserId === user?.id ? myName : (opponentName || (isAr ? 'الخصم' : 'Opponent'));
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
    if (game.status === 'waiting') return isAr ? 'بانتظار انضمام صديقك…' : 'Waiting for your friend to join…';
    if (game.status === 'draw') return isAr ? 'تعادل!' : "It's a draw!";
    if (game.status === 'abandoned' && game.result_reason === 'player_left') {
      return isAr ? `غادر ${opponentName || (isAr ? 'الخصم' : 'Opponent')} اللعبة` : `${opponentName || 'Opponent'} left the game`;
    }
    if (game.status === 'abandoned') return isAr ? 'تم إنهاء اللعبة' : 'Game ended';
    if (iWon) return isAr ? 'فوز! 🎉' : 'You won! 🎉';
    if (iLost) return isAr ? 'خسرت هذه الجولة' : 'You lost this round';
    if (isMyTurn) return isAr ? 'دورك' : 'Your turn';
    return isAr ? `دور ${opponentName || (isAr ? 'الخصم' : 'Opponent')}` : `${opponentName || 'Opponent'}'s turn`;
  })();

  const reasonText = (() => {
    if (!game.result_reason) return null;
    const map: Record<string, string> = {
      checkmate: isAr ? 'كش مات' : 'Checkmate',
      stalemate: isAr ? 'تعادل - ستالمِيت' : 'Stalemate',
      threefold_repetition: isAr ? 'تعادل - تكرار ثلاثي' : 'Threefold repetition',
      insufficient_material: isAr ? 'تعادل - مواد غير كافية' : 'Insufficient material',
      draw: isAr ? 'تعادل' : 'Draw',
      player_left: isAr ? 'غادر اللاعب الآخر' : 'Other player left',
      timeout: isAr ? 'انتهى الوقت' : 'Timed out',
    };
    return map[game.result_reason] || game.result_reason;
  })();

  return (
    <div className="space-y-3 select-none">
      <OpponentLeftDialog
        open={opponentLeftOpen}
        language={language}
        gameName="Chess"
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
              <button onClick={copyCode} className="inline-flex items-center text-blue-600 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200" aria-label="copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white">
              {iWon && <Trophy className="h-4 w-4 text-amber-500" />}
              <span className="truncate">{statusText}</span>
            </p>
            {reasonText && <p className="mt-1 truncate text-[11px] text-[#060541]/55 dark:text-white/50">{reasonText}</p>}
          </div>
          <div className="text-right text-[12px] text-[#060541]/65 dark:text-white/60">
            <div className="truncate">
              {myName}: <span className="font-semibold text-[#060541] dark:text-white">{myColor === 'white' ? (isAr ? 'أبيض' : 'White') : myColor === 'black' ? (isAr ? 'أسود' : 'Black') : '—'}</span>
            </div>
            <div className="truncate">{opponentName || (isAr ? 'بانتظار الانضمام' : 'Waiting to join')}</div>
          </div>
        </div>

        <div className="mt-2">
          <MultiplayerScoreboard
            language={language}
            leftName={myName}
            leftScore={score.me}
            rightName={opponentName || (isAr ? 'الخصم' : 'Opponent')}
            rightScore={score.other}
          />
        </div>
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
        <div className="text-center text-xs text-slate-600 dark:text-slate-400">
          {game.status === 'waiting'
            ? (isAr ? 'شارك الرمز مع صديقك لينضم.' : 'Share the code so your friend can join.')
            : submitting
              ? (isAr ? 'جارٍ إرسال الحركة...' : 'Sending move...')
              : isMyTurn
                ? (isAr ? 'اضغط القطعة ثم المربع الهدف' : 'Tap the piece, then the destination square')
                : (isAr ? 'بانتظار حركة الخصم' : 'Waiting for opponent move')}
        </div>
      )}

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
