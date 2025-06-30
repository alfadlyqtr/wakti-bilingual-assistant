
-- Remove PayPal-specific columns from profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS paypal_subscription_id;

-- Remove PayPal-specific columns from subscriptions table
ALTER TABLE public.subscriptions 
DROP COLUMN IF EXISTS paypal_subscription_id,
DROP COLUMN IF EXISTS paypal_plan_id;

-- Drop PayPal-related functions
DROP FUNCTION IF EXISTS public.get_user_payment_history(uuid);
DROP FUNCTION IF EXISTS public.admin_activate_subscription(uuid, text, numeric, text, text);

-- Create simplified admin_activate_subscription function without PayPal references
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
BEGIN
  -- Calculate next billing date based on plan
  IF p_plan_name ILIKE '%yearly%' OR p_plan_name ILIKE '%year%' THEN
    v_next_billing_date := v_start_date + INTERVAL '1 year';
  ELSE
    v_next_billing_date := v_start_date + INTERVAL '1 month';
  END IF;
  
  -- Update profile
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = p_plan_name,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
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
    next_billing_date
  ) VALUES (
    p_user_id,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' ELSE 'monthly' END,
    v_start_date,
    v_next_billing_date
  );
  
  RETURN true;
END;
$function$;

-- Clean up any existing PayPal webhook-related data
DELETE FROM public.audit_logs WHERE details->>'type' = 'paypal_webhook';
