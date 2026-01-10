-- =============================================
-- WAKTI Backend - Complete Database Schema
-- =============================================

-- 1. Track backend state per project
CREATE TABLE public.project_backends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ,
  features JSONB DEFAULT '{}',
  allowed_origins TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id)
);

-- 2. Flexible data storage for any type of content
CREATE TABLE public.project_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'active',
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries per project/collection
CREATE INDEX idx_project_collections_lookup ON public.project_collections(project_id, collection_name);

-- 3. Schema definitions for each collection
CREATE TABLE public.project_collection_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  display_name TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, collection_name)
);

-- 4. Form submissions (contact, quote, newsletter, etc.)
CREATE TABLE public.project_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_name TEXT DEFAULT 'contact',
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'unread',
  origin TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_form_submissions_lookup ON public.project_form_submissions(project_id, form_name);

-- 5. File uploads
CREATE TABLE public.project_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  size_bytes INTEGER,
  collection_name TEXT,
  collection_item_id UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_project_uploads_lookup ON public.project_uploads(project_id);

-- 6. Customer accounts for user's published sites
CREATE TABLE public.project_site_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  UNIQUE(project_id, email)
);

CREATE INDEX idx_project_site_users_lookup ON public.project_site_users(project_id, email);

-- =============================================
-- Enable RLS on all tables
-- =============================================

ALTER TABLE public.project_backends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collection_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_site_users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies - project_backends
-- =============================================

CREATE POLICY "Users can view their own project backends"
  ON public.project_backends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project backends"
  ON public.project_backends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project backends"
  ON public.project_backends FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project backends"
  ON public.project_backends FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies - project_collections
-- =============================================

CREATE POLICY "Users can view their own project collections"
  ON public.project_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own project collections"
  ON public.project_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project collections"
  ON public.project_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project collections"
  ON public.project_collections FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies - project_collection_schemas
-- =============================================

CREATE POLICY "Users can view their own collection schemas"
  ON public.project_collection_schemas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collection schemas"
  ON public.project_collection_schemas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collection schemas"
  ON public.project_collection_schemas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collection schemas"
  ON public.project_collection_schemas FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies - project_form_submissions
-- =============================================

CREATE POLICY "Users can view their own form submissions"
  ON public.project_form_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own form submissions"
  ON public.project_form_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own form submissions"
  ON public.project_form_submissions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own form submissions"
  ON public.project_form_submissions FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies - project_uploads
-- =============================================

CREATE POLICY "Users can view their own uploads"
  ON public.project_uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own uploads"
  ON public.project_uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
  ON public.project_uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
  ON public.project_uploads FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- RLS Policies - project_site_users
-- =============================================

CREATE POLICY "Owners can view their project site users"
  ON public.project_site_users FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can create project site users"
  ON public.project_site_users FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their project site users"
  ON public.project_site_users FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their project site users"
  ON public.project_site_users FOR DELETE
  USING (auth.uid() = owner_id);

-- =============================================
-- Storage Bucket for project uploads
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-uploads',
  'project-uploads',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/json']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for project-uploads bucket
CREATE POLICY "Users can upload to their project folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their project uploads"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their project uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-uploads' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can view project uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-uploads');

-- =============================================
-- Update timestamp trigger
-- =============================================

CREATE OR REPLACE FUNCTION public.update_project_backend_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_project_backends_updated_at
  BEFORE UPDATE ON public.project_backends
  FOR EACH ROW EXECUTE FUNCTION public.update_project_backend_updated_at();

CREATE TRIGGER update_project_collections_updated_at
  BEFORE UPDATE ON public.project_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_project_backend_updated_at();

CREATE TRIGGER update_project_collection_schemas_updated_at
  BEFORE UPDATE ON public.project_collection_schemas
  FOR EACH ROW EXECUTE FUNCTION public.update_project_backend_updated_at();