// @ts-nocheck
// Tic-Tac-Toe Multiplayer service.
// Tables/RPCs are not yet in the generated supabase types; we use a loose `any` client.
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';

const db = supabase as any;

export type TttSymbol = 'X' | 'O';
export type TttCell = TttSymbol | null;
export type TttMessageKey = 'good_luck' | 'nice_move' | 'your_turn' | 'good_game' | 'gotta_go' | 'custom';

export interface TttMessageRow {
  id: string;
  game_code: string;
  user_id: string;
  message_key: TttMessageKey;
  custom_text: string | null;
  created_at: string;
}

export interface TttSendMessageInput {
  messageKey: TttMessageKey;
  customText?: string | null;
}

export interface TttGameRow {
  code: string;
  host_user_id: string;
  guest_user_id: string | null;
  host_name: string | null;
  guest_name: string | null;
  host_symbol: TttSymbol;
  current_turn: TttSymbol;
  board: TttCell[];
  status: 'waiting' | 'playing' | 'host_won' | 'guest_won' | 'draw' | 'abandoned';
  winner_user_id: string | null;
  winning_line: number[] | null;
  result_reason: string | null;
  abandoned_by_user_id: string | null;
  last_move_at: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  rematch_code: string | null;
}

export const TicTacToeMultiplayerService = {
  async createGame(hostName: string, hostSymbol: TttSymbol = 'X'): Promise<string> {
    const { data, error } = await db.rpc('tictactoe_create_game', {
      p_host_name: hostName,
      p_host_symbol: hostSymbol,
    });
    if (error) throw error;
    return data as string;
  },

  async joinGame(code: string, guestName: string): Promise<TttGameRow> {
    const { data, error } = await db.rpc('tictactoe_join_game', {
      p_code: code,
      p_guest_name: guestName,
    });
    if (error) throw error;
    return data as TttGameRow;
  },

  async fetchGame(code: string): Promise<TttGameRow | null> {
    const { data, error } = await db
      .from('tictactoe_games')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    return (data as TttGameRow) || null;
  },

  async makeMove(params: {
    code: string;
    userId: string;
    symbol: TttSymbol;
    cellIndex: number;
    moveNo: number;
  }): Promise<void> {
    const { error } = await db.from('tictactoe_moves').insert({
      game_code: params.code,
      user_id: params.userId,
      symbol: params.symbol,
      cell_index: params.cellIndex,
      move_no: params.moveNo,
    });
    if (error) throw error;
  },

  async rematch(code: string): Promise<string> {
    const { data, error } = await db.rpc('tictactoe_rematch', { p_code: code });
    if (error) throw error;
    return data as string;
  },

  async leaveGame(code: string): Promise<TttGameRow> {
    const { data, error } = await db.rpc('tictactoe_leave_game', { p_code: code });
    if (error) throw error;
    return data as TttGameRow;
  },

  notifyLeaveOnExit(code: string, accessToken?: string | null): void {
    if (!accessToken) return;
    fetch(`${SUPABASE_URL}/rest/v1/rpc/tictactoe_leave_game`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ p_code: code }),
    }).catch(() => {});
  },

  async fetchMessages(code: string): Promise<TttMessageRow[]> {
    const { data, error } = await db
      .from('tictactoe_messages')
      .select('*')
      .eq('game_code', code)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) throw error;
    return ((data as TttMessageRow[]) || []).reverse();
  },

  async sendMessage(code: string, userId: string, input: TttSendMessageInput): Promise<TttMessageRow> {
    const { data, error } = await db
      .from('tictactoe_messages')
      .insert({
        game_code: code,
        user_id: userId,
        message_key: input.messageKey,
        custom_text: input.customText ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as TttMessageRow;
  },

  /**
   * Subscribe to realtime UPDATE/INSERT events on a single game row.
   * Returns an unsubscribe function.
   */
  subscribeToGame(code: string, onChange: (row: TttGameRow) => void): () => void {
    const channel = db
      .channel(`ttt:game:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tictactoe_games', filter: `code=eq.${code}` },
        (payload: any) => {
          if (payload.new) onChange(payload.new as TttGameRow);
        }
      )
      .subscribe();
    return () => {
      try { db.removeChannel(channel); } catch {}
    };
  },

  subscribeToMessages(code: string, onMessage: (row: TttMessageRow) => void): () => void {
    const channel = db
      .channel(`ttt:messages:${code}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tictactoe_messages', filter: `game_code=eq.${code}` },
        (payload: any) => {
          if (payload.new) onMessage(payload.new as TttMessageRow);
        }
      )
      .subscribe();
    return () => {
      try { db.removeChannel(channel); } catch {}
    };
  },
};
