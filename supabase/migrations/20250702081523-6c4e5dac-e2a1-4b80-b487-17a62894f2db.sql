
-- Add RLS policies for user_voice_clones table
CREATE POLICY "Users can view their own voice clones" 
ON public.user_voice_clones 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice clones" 
ON public.user_voice_clones 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice clones" 
ON public.user_voice_clones 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice clones" 
ON public.user_voice_clones 
FOR DELETE 
USING (auth.uid() = user_id);

-- Ensure RLS is enabled on the table
ALTER TABLE public.user_voice_clones ENABLE ROW LEVEL SECURITY;
