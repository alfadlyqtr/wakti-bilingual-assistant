-- Create storage bucket for generated files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-files',
  'generated-files',
  false, -- private bucket
  52428800, -- 50 MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   -- .docx
    'application/pdf',                                                            -- .pdf
    'application/vnd.ms-powerpoint',                                              -- .ppt (legacy)
    'application/msword'                                                          -- .doc (legacy)
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for storage bucket
CREATE POLICY "Users can upload their own generated files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own generated files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own generated files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'generated-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMENT ON TABLE storage.buckets IS 'Storage bucket for Smart File Generator output files';
