-- Supabase Storage RLS for project-uploads bucket
-- Fixes: "new row violates row-level security policy" when uploading to storage

-- Drop existing policies for this bucket (if any)
DROP POLICY IF EXISTS "Project owners can read project uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can upload project uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can update project uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can delete project uploads objects" ON storage.objects;

-- Helper condition: object path is "{projectId}/..." and the authenticated user owns that project
-- (storage.foldername(name))[1] returns first folder segment

CREATE POLICY "Project owners can read project uploads objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can upload project uploads objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-uploads'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can update project uploads objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'project-uploads'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can delete project uploads objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.user_id = auth.uid()
  )
);
