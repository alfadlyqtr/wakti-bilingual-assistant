-- New table for project-generated calendar entries (separate from maw3d_events)
-- This allows project bookings to appear in owner's WAKTI calendar without touching maw3d_events

CREATE TABLE public.project_calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  source_type TEXT NOT NULL, -- 'booking', 'order', etc.
  source_id UUID, -- references project_bookings.id or project_orders.id
  title TEXT NOT NULL,
  description TEXT,
  entry_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#4F46E5',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_project_calendar_entries_owner ON public.project_calendar_entries(owner_id);
CREATE INDEX idx_project_calendar_entries_date ON public.project_calendar_entries(entry_date);
CREATE INDEX idx_project_calendar_entries_source ON public.project_calendar_entries(source_type, source_id);

-- Enable RLS
ALTER TABLE public.project_calendar_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: owners can see their own entries
CREATE POLICY "Users can view their own project calendar entries"
  ON public.project_calendar_entries
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can manage their own project calendar entries"
  ON public.project_calendar_entries
  FOR ALL
  USING (owner_id = auth.uid());

-- Update project_bookings to link to project_calendar_entries instead of maw3d_events
-- First drop the old foreign key if it exists and add a new column
ALTER TABLE public.project_bookings 
  DROP COLUMN IF EXISTS maw3d_event_id,
  ADD COLUMN IF NOT EXISTS calendar_entry_id UUID REFERENCES public.project_calendar_entries(id) ON DELETE SET NULL;

-- Enable realtime for project calendar entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_calendar_entries;