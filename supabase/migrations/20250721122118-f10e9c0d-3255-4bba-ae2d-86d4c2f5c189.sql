
-- Create game rooms table for multiplayer Ludo
CREATE TABLE public.ludo_game_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code text NOT NULL UNIQUE,
  host_user_id uuid REFERENCES auth.users NOT NULL,
  game_mode text NOT NULL DEFAULT '1v3',
  max_players integer NOT NULL DEFAULT 4,
  current_players integer NOT NULL DEFAULT 1,
  game_state jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create game players table
CREATE TABLE public.ludo_game_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid REFERENCES public.ludo_game_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  player_name text NOT NULL,
  player_color text NOT NULL,
  player_type text NOT NULL DEFAULT 'human',
  is_ready boolean NOT NULL DEFAULT false,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, player_color)
);

-- Enable RLS
ALTER TABLE public.ludo_game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ludo_game_players ENABLE ROW LEVEL SECURITY;

-- RLS policies for game rooms
CREATE POLICY "Users can view public game rooms" 
  ON public.ludo_game_rooms 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own game rooms" 
  ON public.ludo_game_rooms 
  FOR INSERT 
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update their game rooms" 
  ON public.ludo_game_rooms 
  FOR UPDATE 
  USING (auth.uid() = host_user_id);

CREATE POLICY "Host can delete their game rooms" 
  ON public.ludo_game_rooms 
  FOR DELETE 
  USING (auth.uid() = host_user_id);

-- RLS policies for game players
CREATE POLICY "Users can view players in rooms they're part of" 
  ON public.ludo_game_players 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.ludo_game_players gp 
      WHERE gp.room_id = ludo_game_players.room_id 
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join game rooms as players" 
  ON public.ludo_game_players 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player status" 
  ON public.ludo_game_players 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave game rooms" 
  ON public.ludo_game_players 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Function to generate room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  characters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to update room updated_at
CREATE OR REPLACE FUNCTION update_room_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for updating room timestamp
CREATE TRIGGER update_ludo_room_updated_at
  BEFORE UPDATE ON public.ludo_game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_room_updated_at();

-- Enable realtime for game tables
ALTER TABLE public.ludo_game_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.ludo_game_players REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.ludo_game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ludo_game_players;
