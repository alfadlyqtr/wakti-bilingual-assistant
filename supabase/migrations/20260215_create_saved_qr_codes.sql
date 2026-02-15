-- Create saved_qr_codes table
CREATE TABLE IF NOT EXISTS public.saved_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'QR Code',
  qr_type text NOT NULL DEFAULT 'url',
  data_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast user lookups ordered by date
CREATE INDEX IF NOT EXISTS idx_saved_qr_codes_user_created
  ON public.saved_qr_codes (user_id, created_at DESC);

-- Index for cleanup cron (find old rows efficiently)
CREATE INDEX IF NOT EXISTS idx_saved_qr_codes_created_at
  ON public.saved_qr_codes (created_at);

-- Enable RLS
ALTER TABLE public.saved_qr_codes ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see their own QR codes
CREATE POLICY "Users can view own saved QR codes"
  ON public.saved_qr_codes FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: users can insert their own QR codes
CREATE POLICY "Users can insert own saved QR codes"
  ON public.saved_qr_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: users can delete their own QR codes
CREATE POLICY "Users can delete own saved QR codes"
  ON public.saved_qr_codes FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-delete function: removes QR codes older than 20 days
CREATE OR REPLACE FUNCTION public.cleanup_old_saved_qr_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.saved_qr_codes
  WHERE created_at < now() - interval '20 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old saved QR codes', deleted_count;
  RETURN deleted_count;
END;
$$;

-- Schedule daily cleanup via pg_cron (runs at 03:00 UTC daily)
DO $$
BEGIN
  -- Unschedule if exists
  BEGIN
    PERFORM cron.unschedule('cleanup-saved-qr-codes');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule new job
  PERFORM cron.schedule(
    'cleanup-saved-qr-codes',
    '0 3 * * *',
    'SELECT public.cleanup_old_saved_qr_codes();'
  );
END $$;
