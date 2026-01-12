-- Create warranty-docs storage bucket for warranty receipts and documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'warranty-docs',
  'warranty-docs',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on warranty-docs bucket
CREATE POLICY "Users can upload their own warranty documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'warranty-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own warranty documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'warranty-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own warranty documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'warranty-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own warranty documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'warranty-docs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Public access for viewing (since bucket is public)
CREATE POLICY "Public can view warranty documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'warranty-docs');
