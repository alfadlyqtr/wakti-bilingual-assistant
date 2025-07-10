
-- Create table for video generation tasks
CREATE TABLE public.video_generation_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  task_id TEXT NOT NULL,
  template TEXT,
  images TEXT[] NOT NULL,
  prompt TEXT,
  seed INTEGER,
  aspect_ratio TEXT DEFAULT '16:9',
  resolution TEXT DEFAULT '360p',
  duration INTEGER DEFAULT 4,
  movement_amplitude TEXT DEFAULT 'auto',
  bgm BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'queueing', 'processing', 'success', 'failed')),
  video_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.video_generation_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for video generation tasks
CREATE POLICY "Users can view their own video tasks" 
  ON public.video_generation_tasks 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video tasks" 
  ON public.video_generation_tasks 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video tasks" 
  ON public.video_generation_tasks 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_video_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_video_tasks_updated_at_trigger
  BEFORE UPDATE ON public.video_generation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_video_tasks_updated_at();
