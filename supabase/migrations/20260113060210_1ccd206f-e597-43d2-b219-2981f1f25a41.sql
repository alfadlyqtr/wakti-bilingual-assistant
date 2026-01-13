-- Create project AI preferences table for storing user preferences
CREATE TABLE public.project_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_approve_migrations BOOLEAN DEFAULT FALSE,
  preferred_auth_method TEXT,
  preferred_layout_style TEXT,
  skip_clarifying_questions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_ai_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "Users manage own AI preferences" ON public.project_ai_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE TRIGGER update_project_ai_preferences_updated_at
  BEFORE UPDATE ON public.project_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();