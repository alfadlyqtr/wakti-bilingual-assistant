
-- Phase 1: Database Schema Updates - Preserve PayPal while adding Fawran tracking

-- Add payment method tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS fawran_payment_id UUID REFERENCES public.pending_fawran_payments(id);

-- Add payment method tracking to subscriptions table  
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'paypal',
ADD COLUMN IF NOT EXISTS fawran_payment_id UUID REFERENCES public.pending_fawran_payments(id);

-- Update admin_activate_subscription function to support both PayPal and Fawran
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_payment_method text DEFAULT 'manual',
  p_paypal_subscription_id text DEFAULT NULL,
  p_fawran_payment_id uuid DEFAULT NULL
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
  
  -- Generate subscription ID based on payment method
  IF p_payment_method = 'paypal' AND p_paypal_subscription_id IS NOT NULL THEN
    v_subscription_id := p_paypal_subscription_id;
  ELSIF p_payment_method = 'fawran' AND p_fawran_payment_id IS NOT NULL THEN
    v_subscription_id := 'FAWRAN-' || p_fawran_payment_id::text;
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
    payment_method = p_payment_method,
    fawran_payment_id = p_fawran_payment_id,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Create subscription record
  INSERT INTO public.subscriptions (
    user_id,
    paypal_subscription_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date,
    payment_method,
    fawran_payment_id
  ) VALUES (
    p_user_id,
    v_subscription_id,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' ELSE 'monthly' END,
    v_start_date,
    v_next_billing_date,
    p_payment_method,
    p_fawran_payment_id
  );
  
  RETURN true;
END;
$function$;

-- Create function to get Fawran payment statistics
CREATE OR REPLACE FUNCTION public.get_fawran_payment_stats()
RETURNS TABLE(
  total_payments integer,
  pending_payments integer,
  approved_payments integer,
  rejected_payments integer,
  auto_approved_payments integer,
  manual_reviewed_payments integer,
  avg_processing_time_ms numeric,
  tampering_detected_count integer,
  duplicate_detected_count integer,
  time_validation_failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::integer as pending_payments,
    COUNT(*) FILTER (WHERE status = 'approved')::integer as approved_payments,
    COUNT(*) FILTER (WHERE status = 'rejected')::integer as rejected_payments,
    COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at IS NOT NULL AND review_notes LIKE '%auto_approved":true%')::integer as auto_approved_payments,
    COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at IS NOT NULL AND review_notes NOT LIKE '%auto_approved":true%')::integer as manual_reviewed_payments,
    AVG((review_notes::jsonb->>'processing_time_ms')::numeric) as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE tampering_detected = true)::integer as tampering_detected_count,
    COUNT(*) FILTER (WHERE duplicate_detected = true)::integer as duplicate_detected_count,
    COUNT(*) FILTER (WHERE time_validation_passed = false)::integer as time_validation_failed_count
  FROM public.pending_fawran_payments;
END;
$function$;

-- Create function to get payment method distribution
CREATE OR REPLACE FUNCTION public.get_payment_method_stats()
RETURNS TABLE(
  payment_method text,
  user_count integer,
  total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.payment_method, 'legacy') as payment_method,
    COUNT(*)::integer as user_count,
    SUM(s.billing_amount) as total_revenue
  FROM public.profiles p
  LEFT JOIN public.subscriptions s ON p.id = s.user_id AND s.status = 'active'
  WHERE p.is_subscribed = true 
    AND p.subscription_status = 'active'
    AND p.display_name != '[DELETED USER]'
  GROUP BY p.payment_method
  ORDER BY user_count DESC;
END;
$function$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_payment_method ON public.profiles(payment_method);
CREATE INDEX IF NOT EXISTS idx_profiles_fawran_payment_id ON public.profiles(fawran_payment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method ON public.subscriptions(payment_method);
CREATE INDEX IF NOT EXISTS idx_subscriptions_fawran_payment_id ON public.subscriptions(fawran_payment_id);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.payment_method IS 'Payment method used for subscription: paypal, fawran, manual, or legacy';
COMMENT ON COLUMN public.profiles.fawran_payment_id IS 'Reference to Fawran payment if subscription was activated via Fawran';
COMMENT ON COLUMN public.subscriptions.payment_method IS 'Payment method used for this subscription';
COMMENT ON COLUMN public.subscriptions.fawran_payment_id IS 'Reference to Fawran payment if subscription was activated via Fawran';
