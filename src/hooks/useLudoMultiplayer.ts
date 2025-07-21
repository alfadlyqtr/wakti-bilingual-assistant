
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GameRoom {
  id: string;
  room_code: string;
  host_user_id: string;
  game_mode: string;
  max_players: number;
  current_players: number;
  game_state: any;
  status: string;
  created_at: string;
  updated_at: string;
}

interface GamePlayer {
  id: string;
  room_id: string;
  user_id: string;
  player_name: string;
  player_color: string;
  player_type: string;
  is_ready: boolean;
  last_seen: string;
  created_at: string;
}

export function useLudoMultiplayer() {
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(async (gameMode: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const roomCode = generateRoomCode();
      
      const { data: room, error } = await supabase
        .from('ludo_game_rooms')
        .insert({
          room_code: roomCode,
          host_user_id: user.id,
          game_mode: gameMode,
          status: 'waiting'
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentRoom(room);
      return room;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string, playerName: string, playerColor: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find room by code
      const { data: room, error: roomError } = await supabase
        .from('ludo_game_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .eq('status', 'waiting')
        .single();

      if (roomError) throw new Error('Room not found or game already started');

      // Join as player
      const { data: player, error: playerError } = await supabase
        .from('ludo_game_players')
        .insert({
          room_id: room.id,
          user_id: user.id,
          player_name: playerName,
          player_color: playerColor,
          player_type: 'human'
        })
        .select()
        .single();

      if (playerError) throw playerError;

      setCurrentRoom(room);
      return player;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const updateGameState = useCallback(async (gameState: any) => {
    if (!currentRoom) return;

    try {
      const { error } = await supabase
        .from('ludo_game_rooms')
        .update({ game_state: gameState })
        .eq('id', currentRoom.id);

      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  }, [currentRoom]);

  const leaveRoom = useCallback(async () => {
    if (!currentRoom) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('ludo_game_players')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('user_id', user.id);

      setCurrentRoom(null);
      setPlayers([]);
    } catch (err) {
      setError(err.message);
    }
  }, [currentRoom]);

  // Real-time subscriptions
  useEffect(() => {
    if (!currentRoom) return;

    // Subscribe to room updates
    const roomChannel = supabase
      .channel(`room:${currentRoom.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'ludo_game_rooms', filter: `id=eq.${currentRoom.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setCurrentRoom(payload.new as GameRoom);
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ludo_game_players', filter: `room_id=eq.${currentRoom.id}` },
        (payload) => {
          fetchPlayers();
        }
      )
      .subscribe();

    // Subscribe to presence
    const presenceChannel = supabase
      .channel(`presence:${currentRoom.id}`)
      .on('presence', { event: 'sync' }, () => {
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Player joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Player left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await presenceChannel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        }
      });

    const fetchPlayers = async () => {
      const { data: playersData, error } = await supabase
        .from('ludo_game_players')
        .select('*')
        .eq('room_id', currentRoom.id);

      if (!error && playersData) {
        setPlayers(playersData);
      }
    };

    fetchPlayers();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [currentRoom]);

  return {
    currentRoom,
    players,
    isConnected,
    error,
    createRoom,
    joinRoom,
    updateGameState,
    leaveRoom
  };
}

function generateRoomCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
