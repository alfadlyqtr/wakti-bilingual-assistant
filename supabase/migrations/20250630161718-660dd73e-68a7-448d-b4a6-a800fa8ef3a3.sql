
-- Fix the pending_fawran_payments table schema to match code expectations
ALTER TABLE public.pending_fawran_payments 
ADD COLUMN IF NOT EXISTS sender_alias text;

-- Ensure all required columns exist for the upload process
ALTER TABLE public.pending_fawran_payments 
ADD COLUMN IF NOT EXISTS payment_reference_number text,
ADD COLUMN IF NOT EXISTS transaction_reference_number text;

-- Add missing columns that might be referenced in the code
ALTER TABLE public.pending_fawran_payments 
ADD COLUMN IF NOT EXISTS screenshot_hash text,
ADD COLUMN IF NOT EXISTS account_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS time_validation_passed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tampering_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS duplicate_detected boolean DEFAULT false;

-- Update the plan_type constraint to match the code
ALTER TABLE public.pending_fawran_payments 
DROP CONSTRAINT IF EXISTS pending_fawran_payments_plan_type_check;

ALTER TABLE public.pending_fawran_payments 
ADD CONSTRAINT pending_fawran_payments_plan_type_check 
CHECK (plan_type IN ('monthly', 'yearly'));

-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Admins can view all Fawran payments" ON public.pending_fawran_payments;
CREATE POLICY "Admins can view all Fawran payments" 
ON public.pending_fawran_payments
FOR SELECT USING (true);

-- Add admin storage access for fawran-screenshots
DROP POLICY IF EXISTS "Admins can view all fawran screenshots" ON storage.objects;
CREATE POLICY "Admins can view all fawran screenshots" 
ON storage.objects
FOR SELECT USING (bucket_id = 'fawran-screenshots');
