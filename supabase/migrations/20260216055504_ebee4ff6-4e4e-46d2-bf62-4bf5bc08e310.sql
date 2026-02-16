
-- Create partners storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('partners', 'partners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for partners" ON storage.objects
FOR SELECT USING (bucket_id = 'partners');

-- Allow authenticated users to upload
CREATE POLICY "Auth users can upload partners" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'partners' AND auth.role() = 'authenticated');
