
-- First, let's see what's actually in the subscriptions table for debugging
-- We'll update the admin function to properly handle PayPal subscription IDs

-- Update the admin_activate_subscription function to accept and store real PayPal subscription IDs
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_paypal_subscription_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
  v_subscription_id text;
BEGIN
  -- Calculate next billing date based on plan
  IF p_plan_name ILIKE '%yearly%' OR p_plan_name ILIKE '%year%' THEN
    v_next_billing_date := v_start_date + INTERVAL '1 year';
  ELSE
    v_next_billing_date := v_start_date + INTERVAL '1 month';
  END IF;
  
  -- Use provided PayPal subscription ID or generate a proper admin one
  IF p_paypal_subscription_id IS NOT NULL THEN
    v_subscription_id := p_paypal_subscription_id;
  ELSE
    v_subscription_id := 'ADMIN-MANUAL-' || extract(epoch from now())::text;
  END IF;
  
  -- Update profile
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = p_plan_name,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    paypal_subscription_id = v_subscription_id,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Create or update subscription record
  INSERT INTO public.subscriptions (
    user_id,
    paypal_subscription_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date
  ) VALUES (
    p_user_id,
    v_subscription_id,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' ELSE 'monthly' END,
    v_start_date,
    v_next_billing_date
  )
  ON CONFLICT (paypal_subscription_id) 
  DO UPDATE SET
    status = 'active',
    plan_name = EXCLUDED.plan_name,
    billing_amount = EXCLUDED.billing_amount,
    billing_currency = EXCLUDED.billing_currency,
    billing_cycle = EXCLUDED.billing_cycle,
    start_date = EXCLUDED.start_date,
    next_billing_date = EXCLUDED.next_billing_date,
    updated_at = now();
  
  RETURN true;
END;
$function$;

-- Fix avatars storage bucket policies
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;

-- Create proper RLS policies for avatar uploads
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update avatars"
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete avatars"
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Ensure public read access for all avatars
CREATE POLICY "Public avatar access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');
