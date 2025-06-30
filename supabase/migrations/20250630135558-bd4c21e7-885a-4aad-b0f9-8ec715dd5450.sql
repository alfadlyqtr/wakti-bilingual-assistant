
-- Phase 1: Database Schema Enhancement

-- Create screenshot_hashes table for duplicate detection
CREATE TABLE public.screenshot_hashes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  image_hash TEXT NOT NULL,
  payment_id UUID REFERENCES public.pending_fawran_payments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create used_reference_numbers table for reference tracking
CREATE TABLE public.used_reference_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number TEXT NOT NULL,
  transaction_reference TEXT,
  used_by UUID NOT NULL REFERENCES auth.users(id),
  payment_id UUID REFERENCES public.pending_fawran_payments(id),
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to pending_fawran_payments table
ALTER TABLE public.pending_fawran_payments
ADD COLUMN screenshot_hash TEXT,
ADD COLUMN payment_reference_number TEXT,
ADD COLUMN transaction_reference_number TEXT,
ADD COLUMN account_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN time_validation_passed BOOLEAN DEFAULT false,
ADD COLUMN tampering_detected BOOLEAN DEFAULT false,
ADD COLUMN duplicate_detected BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_screenshot_hashes_hash ON public.screenshot_hashes(image_hash);
CREATE INDEX idx_screenshot_hashes_user ON public.screenshot_hashes(user_id);
CREATE INDEX idx_used_reference_numbers_ref ON public.used_reference_numbers(reference_number);
CREATE INDEX idx_used_reference_numbers_trans ON public.used_reference_numbers(transaction_reference);
CREATE INDEX idx_pending_fawran_hash ON public.pending_fawran_payments(screenshot_hash);

-- Create unique constraints to prevent duplicates
ALTER TABLE public.used_reference_numbers ADD CONSTRAINT unique_reference_number UNIQUE (reference_number);
ALTER TABLE public.screenshot_hashes ADD CONSTRAINT unique_image_hash UNIQUE (image_hash);

-- Enable RLS on new tables
ALTER TABLE public.screenshot_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_reference_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies for screenshot_hashes
CREATE POLICY "Users can view their own screenshot hashes"
  ON public.screenshot_hashes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own screenshot hashes"
  ON public.screenshot_hashes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for used_reference_numbers (admin only for security)
CREATE POLICY "Only service role can access reference numbers"
  ON public.used_reference_numbers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger to update screenshot_hashes updated_at
CREATE OR REPLACE FUNCTION public.update_screenshot_hashes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column and trigger to screenshot_hashes
ALTER TABLE public.screenshot_hashes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
CREATE TRIGGER screenshot_hashes_updated_at
  BEFORE UPDATE ON public.screenshot_hashes
  FOR EACH ROW EXECUTE FUNCTION public.update_screenshot_hashes_updated_at();

-- Add updated_at column and trigger to used_reference_numbers  
ALTER TABLE public.used_reference_numbers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
CREATE TRIGGER used_reference_numbers_updated_at
  BEFORE UPDATE ON public.used_reference_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_screenshot_hashes_updated_at();
