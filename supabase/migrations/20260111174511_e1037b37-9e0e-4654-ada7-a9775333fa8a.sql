-- Fix the typo in project_collection_schemas DELETE policy
-- (referenced project_collections instead of project_collection_schemas)

DROP POLICY IF EXISTS "Project owners can delete schemas" ON public.project_collection_schemas;

CREATE POLICY "Project owners can delete schemas" 
ON public.project_collection_schemas 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_collection_schemas.project_id 
    AND projects.user_id = auth.uid()
  )
);