
-- Update the admin_activate_subscription function to use proper gift duration calculations
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid,
  p_plan_name text,
  p_billing_amount numeric,
  p_billing_currency text DEFAULT 'QAR',
  p_payment_method text DEFAULT 'manual',
  p_fawran_payment_id uuid DEFAULT NULL,
  p_is_gift boolean DEFAULT false,
  p_gift_duration text DEFAULT NULL,
  p_gift_given_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
  v_subscription_id uuid;
  v_billing_cycle text;
BEGIN
  -- Calculate proper next billing date based on gift duration or plan type
  IF p_is_gift AND p_gift_duration IS NOT NULL THEN
    CASE p_gift_duration
      WHEN '1_week' THEN
        v_next_billing_date := v_start_date + INTERVAL '7 days';
      WHEN '2_weeks' THEN
        v_next_billing_date := v_start_date + INTERVAL '14 days';
      WHEN '1_month' THEN
        v_next_billing_date := v_start_date + INTERVAL '30 days';
      ELSE
        v_next_billing_date := v_start_date + INTERVAL '7 days'; -- Default to 1 week
    END CASE;
    v_billing_cycle := 'gift';
  ELSE
    -- Regular subscription
    IF p_plan_name ILIKE '%yearly%' THEN
      v_next_billing_date := v_start_date + INTERVAL '1 year';
      v_billing_cycle := 'yearly';
    ELSE
      v_next_billing_date := v_start_date + INTERVAL '1 month';
      v_billing_cycle := 'monthly';
    END IF;
  END IF;

  -- Create subscription record
  INSERT INTO public.subscriptions (
    user_id,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    payment_method,
    start_date,
    next_billing_date,
    fawran_payment_id,
    is_gift,
    gift_duration,
    gift_given_by,
    status
  ) VALUES (
    p_user_id,
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    v_billing_cycle,
    p_payment_method,
    v_start_date,
    v_next_billing_date,
    p_fawran_payment_id,
    p_is_gift,
    p_gift_duration,
    p_gift_given_by,
    'active'
  ) RETURNING id INTO v_subscription_id;

  -- Update user profile
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

  -- Log admin activity for gifts
  IF p_is_gift AND p_gift_given_by IS NOT NULL THEN
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
        'user_id', p_user_id,
        'gift_duration', p_gift_duration,
        'plan_name', p_plan_name,
        'start_date', v_start_date,
        'expiry_date', v_next_billing_date,
        'billing_amount', p_billing_amount
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'start_date', v_start_date,
    'expiry_date', v_next_billing_date,
    'gift_duration_days', 
    CASE 
      WHEN p_gift_duration = '1_week' THEN 7
      WHEN p_gift_duration = '2_weeks' THEN 14
      WHEN p_gift_duration = '1_month' THEN 30
      ELSE NULL
    END
  );
END;
$$;
