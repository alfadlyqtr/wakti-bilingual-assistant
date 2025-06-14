
-- 1. Get Alanoud's profile/user id (assume case-insensitive email search)
DO $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_next_month timestamptz;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE lower(email) = lower('alanoud.qtr6@gmail.com') LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email alanoud.qtr6@gmail.com';
  END IF;

  -- Calculate next billing date (1 month from now)
  v_next_month := v_now + INTERVAL '1 month';

  -- 2. Update profile
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = 'Monthly',
    billing_start_date = v_now,
    next_billing_date = v_next_month,
    paypal_subscription_id = 'I-CRLV1LY33R8B',
    updated_at = v_now
  WHERE id = v_user_id;

  -- 3. Create or update subscription record (use upsert by unique PayPal subscription ID)
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
    'I-CRLV1LY33R8B',
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
  )
  ON CONFLICT (paypal_subscription_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    status = EXCLUDED.status,
    plan_name = EXCLUDED.plan_name,
    billing_amount = EXCLUDED.billing_amount,
    billing_currency = EXCLUDED.billing_currency,
    billing_cycle = EXCLUDED.billing_cycle,
    start_date = EXCLUDED.start_date,
    next_billing_date = EXCLUDED.next_billing_date,
    updated_at = EXCLUDED.updated_at;
END $$;
