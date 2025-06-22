
-- Update the admin_activate_subscription function to include paypal_plan_id parameter
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_paypal_plan_id text DEFAULT 'ADMIN-GIFT-PLAN'
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
  ELSIF p_plan_name ILIKE '%2 weeks%' THEN
    v_next_billing_date := v_start_date + INTERVAL '2 weeks';
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
  
  -- Create subscription record with paypal_plan_id
  INSERT INTO public.subscriptions (
    user_id,
    paypal_subscription_id,
    paypal_plan_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date
  ) VALUES (
    p_user_id,
    'ADMIN-MANUAL-' || extract(epoch from now())::text,
    p_paypal_plan_id,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE 
      WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' 
      WHEN p_plan_name ILIKE '%2 weeks%' THEN 'bi-weekly'
      ELSE 'monthly' 
    END,
    v_start_date,
    v_next_billing_date
  );
  
  RETURN true;
END;
$function$
