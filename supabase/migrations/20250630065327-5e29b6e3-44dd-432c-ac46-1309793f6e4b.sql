
-- Create table for pending Fawran payments
CREATE TABLE IF NOT EXISTS public.pending_fawran_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  amount numeric NOT NULL,
  screenshot_url text NOT NULL,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')) NOT NULL,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.pending_fawran_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payment submissions" ON public.pending_fawran_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment submissions" ON public.pending_fawran_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fawran-screenshots',
  'fawran-screenshots',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload payment screenshots" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fawran-screenshots' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own payment screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fawran-screenshots' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_pending_fawran_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pending_fawran_payments_updated_at
  BEFORE UPDATE ON public.pending_fawran_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_fawran_payments_updated_at();
