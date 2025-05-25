
-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  location_link TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  background_color TEXT,
  background_gradient TEXT,
  background_image TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  text_color TEXT DEFAULT '#ffffff',
  font_size INTEGER DEFAULT 16,
  button_style TEXT DEFAULT 'rounded',
  organizer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create RSVP table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  guest_name TEXT,
  guest_email TEXT,
  response TEXT NOT NULL CHECK(response IN ('accepted', 'declined', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  guest_ip TEXT,
  is_wakti_user BOOLEAN DEFAULT FALSE,
  
  -- Constraint to ensure either user_id is set (for WAKTI users) or guest_name is set (for guests)
  CONSTRAINT rsvp_user_or_guest CHECK (
    (user_id IS NOT NULL AND is_wakti_user = TRUE) OR 
    (guest_name IS NOT NULL AND is_wakti_user = FALSE)
  )
);

-- Create event invitees table
CREATE TABLE IF NOT EXISTS public.event_invitees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  guest_email TEXT,
  guest_name TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
  rsvp_id UUID REFERENCES public.event_rsvps(id),
  
  -- Constraint to ensure either user_id is set (for WAKTI users) or guest_email is set (for guests)
  CONSTRAINT invitee_user_or_guest CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL)
);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invitees ENABLE ROW LEVEL SECURITY;

-- Policies for events
-- Organizer can do anything with their events
CREATE POLICY "Organizers can manage their events" ON public.events
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Users can view public events or events they were invited to
CREATE POLICY "Users can view public events or events they were invited to" ON public.events
  FOR SELECT
  USING (
    is_public = TRUE OR 
    EXISTS (
      SELECT 1 FROM public.event_invitees 
      WHERE event_invitees.event_id = events.id AND event_invitees.user_id = auth.uid()
    )
  );

-- Policies for RSVPs
-- Users can manage their own RSVPs
CREATE POLICY "Users can manage their own RSVPs" ON public.event_rsvps
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Event organizers can view all RSVPs for their events
CREATE POLICY "Organizers can view RSVPs for their events" ON public.event_rsvps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_rsvps.event_id AND events.organizer_id = auth.uid()
    )
  );

-- Users can create guest RSVPs for public events
CREATE POLICY "Users can create guest RSVPs for public events" ON public.event_rsvps
  FOR INSERT
  WITH CHECK (
    is_wakti_user = FALSE AND
    user_id IS NULL AND
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_rsvps.event_id AND events.is_public = TRUE
    )
  );

-- Policies for event invitees
-- Event organizers can manage invitees for their events
CREATE POLICY "Organizers can manage invitees for their events" ON public.event_invitees
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invitees.event_id AND events.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = event_invitees.event_id AND events.organizer_id = auth.uid()
    )
  );

-- Users can see invites sent to them
CREATE POLICY "Users can see their own invites" ON public.event_invitees
  FOR SELECT
  USING (user_id = auth.uid());

-- Set up realtime for events
ALTER PUBLICATION supabase_realtime ADD TABLE public.events, public.event_rsvps;
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.event_rsvps REPLICA IDENTITY FULL;
