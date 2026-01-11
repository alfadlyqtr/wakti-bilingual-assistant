-- Drop ALL existing policies for project_uploads (old ones)
DROP POLICY IF EXISTS "Users can view their own uploads" ON public.project_uploads;
DROP POLICY IF EXISTS "Users can create their own uploads" ON public.project_uploads;
DROP POLICY IF EXISTS "Users can update their own uploads" ON public.project_uploads;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON public.project_uploads;

-- Also drop any new policies that may exist to avoid conflicts
DROP POLICY IF EXISTS "Project owners can view uploads" ON public.project_uploads;
DROP POLICY IF EXISTS "Project owners can create uploads" ON public.project_uploads;
DROP POLICY IF EXISTS "Project owners can update uploads" ON public.project_uploads;
DROP POLICY IF EXISTS "Project owners can delete uploads" ON public.project_uploads;

-- Now create the correct policies that check project ownership
CREATE POLICY "Project owners can view uploads" 
ON public.project_uploads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_uploads.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can create uploads" 
ON public.project_uploads 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_uploads.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can update uploads" 
ON public.project_uploads 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_uploads.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can delete uploads" 
ON public.project_uploads 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_uploads.project_id 
    AND projects.user_id = auth.uid()
  )
);