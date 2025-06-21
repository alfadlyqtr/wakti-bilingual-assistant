
-- Manual activation for alfadly@tmw.qa monthly subscription
DO $$
DECLARE
  v_user_id uuid := '3100dea8-837e-49bd-a31c-9813626749b3';
  v_now timestamptz := now();
  v_next_month timestamptz;
BEGIN
  -- Calculate next billing date (1 month from now)
  v_next_month := v_now + INTERVAL '1 month';

  -- Update profile to active subscription
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = 'Monthly',
    billing_start_date = v_now,
    next_billing_date = v_next_month,
    paypal_subscription_id = 'MANUAL-ALFADLY-001',
    updated_at = v_now
  WHERE id = v_user_id;

  -- Create subscription record
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
    next_billing_date,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'MANUAL-ALFADLY-001',
    'P-5RM543441H466435NNBGLCWA', -- Monthly plan ID
    'active',
    'Monthly',
    60,
    'QAR',
    'monthly',
    v_now,
    v_next_month,
    v_now,
    v_now
  );
END $$;
