-- Add RLS policies for public.conversations table
-- Only the group creator can update group details (name, avatar_url)

-- Ensure RLS is enabled
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: Group participants can view conversations they are part of
DROP POLICY IF EXISTS "Group participants can view conversations" ON public.conversations;
CREATE POLICY "Group participants can view conversations"
  ON public.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );

-- UPDATE: Only the group creator can update the conversation
DROP POLICY IF EXISTS "Only creator can update group" ON public.conversations;
CREATE POLICY "Only creator can update group"
  ON public.conversations
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
