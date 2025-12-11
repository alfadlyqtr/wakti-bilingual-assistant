-- Allow public (anonymous) read access to user_music_tracks for sharing
-- This enables the /music/share/:id page to fetch track details without auth

-- First, drop any existing restrictive SELECT policy if it conflicts
-- (Skip if you want to keep owner-only policy alongside this one)

-- Add a policy that allows anyone to read tracks by ID (for public sharing)
CREATE POLICY "Allow public read for music sharing" 
ON public.user_music_tracks 
FOR SELECT 
TO anon, authenticated
USING (true);
