// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export type ChessSide = 'white' | 'black';
export type ChessStatus = 'waiting' | 'playing' | 'host_won' | 'guest_won' | 'draw' | 'abandoned';

export interface ChessGameRow {
  code: string;
  host_user_id: string;
  guest_user_id: string | null;
  host_name: string | null;
  guest_name: string | null;
  host_color: ChessSide;
  current_turn: ChessSide;
  fen: string;
  status: ChessStatus;
  result_reason: string | null;
  winner_user_id: string | null;
  abandoned_by_user_id: string | null;
  rematch_code: string | null;
  last_move_at: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
}

export const ChessMultiplayerService = {
  async createGame(hostName: string, hostColor: ChessSide = 'white'): Promise<string> {
    const { data, error } = await db.rpc('chess_create_game', {
      p_host_name: hostName,
      p_host_color: hostColor,
    });
    if (error) throw error;
    return data as string;
  },

  async joinGame(code: string, guestName: string): Promise<ChessGameRow> {
    const { data, error } = await db.rpc('chess_join_game', {
      p_code: code,
      p_guest_name: guestName,
    });
    if (error) throw error;
    return data as ChessGameRow;
  },

  async fetchGame(code: string): Promise<ChessGameRow | null> {
    const { data, error } = await db
      .from('chess_games')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    return (data as ChessGameRow) || null;
  },

  async submitMove(params: {
    code: string;
    fromSquare: string;
    toSquare: string;
    promotion?: string | null;
    san: string;
    fenAfter: string;
    outcome: 'playing' | 'white_won' | 'black_won' | 'draw';
    resultReason?: string | null;
  }): Promise<ChessGameRow> {
    const { data, error } = await db.rpc('chess_submit_move', {
      p_code: params.code,
      p_from_square: params.fromSquare,
      p_to_square: params.toSquare,
      p_promotion: params.promotion ?? null,
      p_san: params.san,
      p_fen_after: params.fenAfter,
      p_outcome: params.outcome,
      p_result_reason: params.resultReason ?? null,
    });
    if (error) throw error;
    return data as ChessGameRow;
  },

  async rematch(code: string): Promise<string> {
    const { data, error } = await db.rpc('chess_rematch', { p_code: code });
    if (error) throw error;
    return data as string;
  },

  async leaveGame(code: string): Promise<ChessGameRow> {
    const { data, error } = await db.rpc('chess_leave_game', { p_code: code });
    if (error) throw error;
    return data as ChessGameRow;
  },

  subscribeToGame(code: string, onChange: (row: ChessGameRow) => void): () => void {
    const channel = db
      .channel(`chess:game:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chess_games', filter: `code=eq.${code}` },
        (payload: any) => {
          if (payload.new) onChange(payload.new as ChessGameRow);
        }
      )
      .subscribe();

    return () => {
      try { db.removeChannel(channel); } catch {}
    };
  },
};
