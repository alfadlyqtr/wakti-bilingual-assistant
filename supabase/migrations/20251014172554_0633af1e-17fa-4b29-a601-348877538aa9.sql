-- Ensure public storage bucket for vision with safe id
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('wakti-ai-v2', 'wakti-ai-v2', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Policies for public read and authenticated write scoped to user folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read wakti-ai-v2'
  ) THEN
    CREATE POLICY "Public read wakti-ai-v2"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'wakti-ai-v2');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users upload wakti-ai-v2 to their folder'
  ) THEN
    CREATE POLICY "Users upload wakti-ai-v2 to their folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'wakti-ai-v2'
      AND auth.uid()::text = (storage.foldername(name))[2] -- path: vision-temp/{userId}/...
    );
  END IF;
END $$;

-- Optional: allow users to delete their own files in their folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users delete wakti-ai-v2 in their folder'
  ) THEN
    CREATE POLICY "Users delete wakti-ai-v2 in their folder"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'wakti-ai-v2'
      AND auth.uid()::text = (storage.foldername(name))[2]
    );
  END IF;
END $$;