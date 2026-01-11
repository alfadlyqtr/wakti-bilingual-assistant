-- Fix storage.objects policies for bucket project-uploads
-- Previous policies referenced projects.name by mistake; replace with correct folder checks.

-- Remove existing project-uploads-related policies
DROP POLICY IF EXISTS "Project owners can read project uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can upload project uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can update project uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can delete project uploads objects" ON storage.objects;

DROP POLICY IF EXISTS "Users can view their project uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their project uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their project folder" ON storage.objects;
DROP POLICY IF EXISTS "Public can view project uploads" ON storage.objects;

-- New path format enforced:
--   {userId}/{projectId}/{timestamp}-{filename}

CREATE POLICY "Project owners can view project-uploads objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can upload project-uploads objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can update project-uploads objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'project-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Project owners can delete project-uploads objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[2]
      AND p.user_id = auth.uid()
  )
);
