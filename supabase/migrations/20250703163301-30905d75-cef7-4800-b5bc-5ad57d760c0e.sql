
-- Phase 1: Complete PayPal Removal from Database Schema

-- Remove PayPal columns from profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS paypal_subscription_id;

-- Remove PayPal columns from subscriptions table
ALTER TABLE public.subscriptions 
DROP COLUMN IF EXISTS paypal_subscription_id,
DROP COLUMN IF EXISTS paypal_plan_id;

-- Drop PayPal-related functions
DROP FUNCTION IF EXISTS public.get_user_payment_history(uuid);
DROP FUNCTION IF EXISTS public.is_legacy_paypal_user(text);

-- Create new simplified admin_activate_subscription function without PayPal
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_payment_method text DEFAULT 'manual',
  p_fawran_payment_id uuid DEFAULT NULL,
  p_is_gift boolean DEFAULT false,
  p_gift_duration text DEFAULT NULL,
  p_gift_given_by uuid DEFAULT NULL
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
  -- Calculate next billing date based on plan or gift duration
  IF p_is_gift AND p_gift_duration IS NOT NULL THEN
    CASE p_gift_duration
      WHEN '1_week' THEN v_next_billing_date := v_start_date + INTERVAL '1 week';
      WHEN '2_weeks' THEN v_next_billing_date := v_start_date + INTERVAL '2 weeks';
      WHEN '1_month' THEN v_next_billing_date := v_start_date + INTERVAL '1 month';
      ELSE v_next_billing_date := v_start_date + INTERVAL '1 month';
    END CASE;
  ELSIF p_plan_name ILIKE '%yearly%' OR p_plan_name ILIKE '%year%' THEN
    v_next_billing_date := v_start_date + INTERVAL '1 year';
  ELSE
    v_next_billing_date := v_start_date + INTERVAL '1 month';
  END IF;
  
  -- Generate subscription ID based on payment method or gift
  IF p_is_gift THEN
    v_subscription_id := 'GIFT-' || extract(epoch from now())::text;
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
    plan_name = CASE WHEN p_is_gift THEN 'Gift ' || p_gift_duration ELSE p_plan_name END,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    payment_method = CASE WHEN p_is_gift THEN 'gift' ELSE p_payment_method END,
    fawran_payment_id = p_fawran_payment_id,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Create subscription record without PayPal references
  INSERT INTO public.subscriptions (
    user_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date,
    payment_method,
    fawran_payment_id,
    is_gift,
    gift_duration,
    gift_given_by
  ) VALUES (
    p_user_id,
    'active',
    CASE WHEN p_is_gift THEN 'Gift ' || p_gift_duration ELSE p_plan_name END,
    CASE WHEN p_is_gift THEN 0 ELSE p_billing_amount END,
    p_billing_currency,
    CASE 
      WHEN p_is_gift THEN 'gift'
      WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' 
      ELSE 'monthly' 
    END,
    v_start_date,
    v_next_billing_date,
    CASE WHEN p_is_gift THEN 'gift' ELSE p_payment_method END,
    p_fawran_payment_id,
    p_is_gift,
    p_gift_duration,
    p_gift_given_by
  );
  
  -- Log the gift action if it's a gift
  IF p_is_gift THEN
    INSERT INTO public.admin_activity_logs (
      action,
      target_type,
      target_id,
      admin_user_id,
      details
    ) VALUES (
      'gift_subscription_activated',
      'user',
      p_user_id::text,
      p_gift_given_by,
      jsonb_build_object(
        'gift_duration', p_gift_duration,
        'expiry_date', v_next_billing_date,
        'user_email', (SELECT email FROM public.profiles WHERE id = p_user_id)
      )
    );
  END IF;
  
  RETURN true;
END;
$function$;

-- Create RPC functions for admin stats without PayPal references
CREATE OR REPLACE FUNCTION public.get_payment_method_stats()
RETURNS TABLE(payment_method text, user_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.payment_method, 'unknown') as payment_method,
    COUNT(*) as user_count
  FROM public.profiles p
  WHERE p.is_subscribed = true
  GROUP BY p.payment_method;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_fawran_payment_stats()
RETURNS TABLE(
  total_payments bigint,
  pending_payments bigint,
  approved_payments bigint,
  rejected_payments bigint,
  auto_approved_payments bigint,
  manual_reviewed_payments bigint,
  avg_processing_time_ms numeric,
  tampering_detected_count bigint,
  duplicate_detected_count bigint,
  time_validation_failed_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint as pending_payments,
    COUNT(*) FILTER (WHERE status = 'approved')::bigint as approved_payments,
    COUNT(*) FILTER (WHERE status = 'rejected')::bigint as rejected_payments,
    COUNT(*) FILTER (WHERE status = 'approved' AND review_notes IS NULL)::bigint as auto_approved_payments,
    COUNT(*) FILTER (WHERE status = 'approved' AND review_notes IS NOT NULL)::bigint as manual_reviewed_payments,
    AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) * 1000)::numeric as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE tampering_detected = true)::bigint as tampering_detected_count,
    COUNT(*) FILTER (WHERE duplicate_detected = true)::bigint as duplicate_detected_count,
    COUNT(*) FILTER (WHERE time_validation_passed = false)::bigint as time_validation_failed_count
  FROM public.pending_fawran_payments;
END;
$function$;

-- Clean up any PayPal audit logs
DELETE FROM public.audit_logs WHERE details->>'type' = 'paypal_webhook';

-- Remove the legacy PayPal protection migration effects
-- Users previously protected can now be managed normally
UPDATE public.profiles 
SET payment_method = 'manual'
WHERE payment_method = 'paypal';

-- Update any existing subscriptions to remove PayPal references
UPDATE public.subscriptions 
SET payment_method = 'manual'
WHERE payment_method = 'paypal';
