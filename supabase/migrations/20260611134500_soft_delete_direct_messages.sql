ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.soft_delete_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.messages
  SET is_deleted = true,
      deleted_at = now(),
      content = null,
      media_url = null,
      media_type = null,
      voice_duration = null,
      file_size = null,
      reply_to_id = null
  WHERE id = p_message_id
    AND sender_id = auth.uid()
    AND is_deleted = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN false;
  END IF;

  DELETE FROM public.message_reactions
  WHERE message_id = p_message_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_message(UUID) TO authenticated;
