
-- Add gift subscription fields to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN is_gift boolean DEFAULT false,
ADD COLUMN gift_duration text DEFAULT NULL,
ADD COLUMN gift_given_by uuid DEFAULT NULL;

-- Add indexes for efficient querying of gift subscriptions
CREATE INDEX idx_subscriptions_is_gift ON public.subscriptions(is_gift);
CREATE INDEX idx_subscriptions_gift_expiry ON public.subscriptions(next_billing_date) WHERE is_gift = true;

-- Update the admin_activate_subscription function to support gift subscriptions
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid, 
  p_plan_name text, 
  p_billing_amount numeric DEFAULT 60, 
  p_billing_currency text DEFAULT 'QAR',
  p_payment_method text DEFAULT 'manual',
  p_paypal_subscription_id text DEFAULT NULL,
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
  ELSIF p_payment_method = 'paypal' AND p_paypal_subscription_id IS NOT NULL THEN
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
    plan_name = CASE WHEN p_is_gift THEN 'Gift ' || p_gift_duration ELSE p_plan_name END,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    payment_method = CASE WHEN p_is_gift THEN 'gift' ELSE p_payment_method END,
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
    fawran_payment_id,
    is_gift,
    gift_duration,
    gift_given_by
  ) VALUES (
    p_user_id,
    v_subscription_id,
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

-- Create function to deactivate expired gift subscriptions
CREATE OR REPLACE FUNCTION public.deactivate_expired_gift_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  expired_sub RECORD;
BEGIN
  -- Find all expired gift subscriptions
  FOR expired_sub IN 
    SELECT s.user_id, s.id as subscription_id, p.email, s.gift_duration
    FROM public.subscriptions s
    INNER JOIN public.profiles p ON s.user_id = p.id
    WHERE s.is_gift = true 
      AND s.status = 'active'
      AND s.next_billing_date <= now()
  LOOP
    -- Deactivate the user's subscription
    UPDATE public.profiles
    SET
      is_subscribed = false,
      subscription_status = 'expired',
      updated_at = now()
    WHERE id = expired_sub.user_id;
    
    -- Update subscription status
    UPDATE public.subscriptions
    SET 
      status = 'expired',
      updated_at = now()
    WHERE id = expired_sub.subscription_id;
    
    -- Log the expiration
    INSERT INTO public.admin_activity_logs (
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      'gift_subscription_expired',
      'user',
      expired_sub.user_id::text,
      jsonb_build_object(
        'user_email', expired_sub.email,
        'gift_duration', expired_sub.gift_duration,
        'expired_at', now()
      )
    );
    
    -- Queue notification to user
    PERFORM public.queue_notification(
      expired_sub.user_id,
      'subscription_expired',
      'Gift Subscription Expired',
      'Your gift subscription has expired. Thank you for trying WAKTI!',
      jsonb_build_object('type', 'gift_expired'),
      '/settings'
    );
    
  END LOOP;
  
  RAISE NOTICE 'Processed expired gift subscriptions at %', now();
END;
$function$;

-- Create cron job to run daily at 1 AM to check for expired gift subscriptions
SELECT cron.schedule(
  'deactivate-expired-gifts',
  '0 1 * * *', -- Daily at 1 AM
  $$
  SELECT public.deactivate_expired_gift_subscriptions();
  $$
);
