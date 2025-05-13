
-- Create a function that automatically sets the updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for tables
CREATE TRIGGER set_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_event_rsvps_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_event_invitees_updated_at
BEFORE UPDATE ON public.event_invitees
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
