-- ============================================
-- FIX: Avatars Bucket RLS Policies Cleanup
-- ============================================
-- This migration cleans up duplicate/conflicting RLS policies
-- for the avatars storage bucket and creates fresh, working policies.

-- Step 1: Drop ALL existing avatar-related policies (ignore errors if they don't exist)
DO $$
BEGIN
  -- Old policy names from 20240517
  DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Users Can Upload" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Users Can Update Their Own Avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Users Can Delete Their Own Avatars" ON storage.objects;
  
  -- New policy names from 20251009
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
  
  RAISE NOTICE 'Dropped all existing avatar policies';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some policies may not have existed: %', SQLERRM;
END $$;

-- Step 2: Ensure avatars bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];

-- Step 3: Create fresh, clean RLS policies

-- SELECT: Anyone can view avatars (bucket is public)
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- INSERT: Authenticated users can upload to their own folder
CREATE POLICY "avatars_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: Users can update their own avatars
CREATE POLICY "avatars_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: Users can delete their own avatars
CREATE POLICY "avatars_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
