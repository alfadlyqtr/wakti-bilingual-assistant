
-- Fix the database relationship between pending_fawran_payments and profiles
-- Add proper foreign key constraint and ensure data integrity

-- First, ensure all user_ids in pending_fawran_payments exist in profiles
-- This will prevent foreign key constraint violations
INSERT INTO public.profiles (id, display_name, email, created_at, updated_at)
SELECT DISTINCT 
  pfp.user_id,
  'User ' || substr(pfp.user_id::text, 1, 8) as display_name,
  pfp.email,
  now(),
  now()
FROM public.pending_fawran_payments pfp
WHERE pfp.user_id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Add the foreign key constraint
ALTER TABLE public.pending_fawran_payments 
ADD CONSTRAINT fk_pending_fawran_payments_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_fawran_payments_user_id 
ON public.pending_fawran_payments(user_id);

-- Update the admin_activate_subscription function to be more robust
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
  
  -- Ensure user exists in profiles table
  INSERT INTO public.profiles (id, display_name, email, created_at, updated_at)
  VALUES (
    p_user_id,
    'User ' || substr(p_user_id::text, 1, 8),
    (SELECT email FROM public.pending_fawran_payments WHERE user_id = p_user_id LIMIT 1),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Update profile with subscription info
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
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    plan_name = EXCLUDED.plan_name,
    billing_amount = EXCLUDED.billing_amount,
    next_billing_date = EXCLUDED.next_billing_date,
    payment_method = EXCLUDED.payment_method,
    fawran_payment_id = EXCLUDED.fawran_payment_id,
    updated_at = now();
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in admin_activate_subscription: %', SQLERRM;
  RETURN false;
END;
$function$;

-- Create a function to process stuck payments automatically
CREATE OR REPLACE FUNCTION public.process_stuck_fawran_payments()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stuck_payment RECORD;
  processed_count INTEGER := 0;
  success_count INTEGER := 0;
  result json;
BEGIN
  -- Find payments stuck for more than 3 minutes
  FOR stuck_payment IN 
    SELECT * FROM public.pending_fawran_payments 
    WHERE status = 'pending' 
    AND submitted_at < (now() - INTERVAL '3 minutes')
    ORDER BY submitted_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Try to auto-approve the payment
      UPDATE public.pending_fawran_payments
      SET 
        status = 'approved',
        reviewed_at = now(),
        review_notes = jsonb_build_object(
          'auto_processed', true,
          'reason', 'stuck_payment_recovery',
          'processed_at', now(),
          'original_submit_time', stuck_payment.submitted_at
        )
      WHERE id = stuck_payment.id;
      
      -- Activate subscription
      PERFORM public.admin_activate_subscription(
        stuck_payment.user_id,
        CASE WHEN stuck_payment.plan_type = 'yearly' THEN 'Yearly Plan' ELSE 'Monthly Plan' END,
        stuck_payment.amount,
        'QAR',
        'fawran',
        NULL,
        stuck_payment.id
      );
      
      -- Queue success notification
      PERFORM public.queue_notification(
        stuck_payment.user_id,
        'subscription_activated',
        '🎉 Payment Processed - Subscription Active!',
        'Your Fawran payment has been processed and your subscription is now active. Welcome to Wakti Premium!',
        jsonb_build_object(
          'payment_amount', stuck_payment.amount,
          'plan_type', stuck_payment.plan_type,
          'auto_processed', true,
          'payment_id', stuck_payment.id
        ),
        '/dashboard',
        now()
      );
      
      success_count := success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but continue processing other payments
      RAISE NOTICE 'Failed to process stuck payment %: %', stuck_payment.id, SQLERRM;
    END;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  result := json_build_object(
    'success', true,
    'processed_count', processed_count,
    'success_count', success_count,
    'failed_count', processed_count - success_count,
    'processed_at', now()
  );
  
  RETURN result;
END;
$function$;
