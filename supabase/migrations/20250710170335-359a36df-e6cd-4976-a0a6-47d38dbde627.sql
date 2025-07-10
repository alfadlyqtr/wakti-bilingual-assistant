
-- Create the video_generator_images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video_generator_images',
  'Video Generator Images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
);

-- Create RLS policies for the video_generator_images bucket
CREATE POLICY "Anyone can view video generator images"
ON storage.objects FOR SELECT
USING (bucket_id = 'video_generator_images');

CREATE POLICY "Authenticated users can upload video generator images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'video_generator_images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own video generator images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'video_generator_images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own video generator images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'video_generator_images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
