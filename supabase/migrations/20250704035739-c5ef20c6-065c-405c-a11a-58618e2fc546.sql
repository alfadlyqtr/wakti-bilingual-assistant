
-- First, let's manually fix the two expired gift subscriptions
UPDATE profiles 
SET 
  is_subscribed = false,
  subscription_status = 'expired',
  updated_at = now()
WHERE email IN ('jabor2017@icloud.com', 'mohamedbingha974@gmail.com')
  AND next_billing_date < now();

-- Update their subscription records to expired status
UPDATE subscriptions 
SET 
  status = 'expired',
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE email IN ('jabor2017@icloud.com', 'mohamedbingha974@gmail.com')
) AND next_billing_date < now();

-- Create a function to automatically expire subscriptions
CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER := 0;
  result json;
BEGIN
  -- Update expired subscriptions in profiles table
  UPDATE profiles 
  SET 
    is_subscribed = false,
    subscription_status = 'expired',
    updated_at = now()
  WHERE is_subscribed = true 
    AND next_billing_date IS NOT NULL 
    AND next_billing_date < now();
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Update expired subscriptions in subscriptions table
  UPDATE subscriptions 
  SET 
    status = 'expired',
    updated_at = now()
  WHERE status = 'active' 
    AND next_billing_date < now();
  
  -- Log the expiry action
  INSERT INTO admin_activity_logs (
    action,
    target_type,
    details
  ) VALUES (
    'automatic_subscription_expiry',
    'system',
    jsonb_build_object(
      'expired_count', expired_count,
      'processed_at', now(),
      'type', 'daily_expiry_check'
    )
  );
  
  result := json_build_object(
    'success', true,
    'expired_count', expired_count,
    'processed_at', now()
  );
  
  RETURN result;
END;
$$;

-- Create a cron job to run daily at midnight to check for expired subscriptions
SELECT cron.schedule(
  'daily-subscription-expiry-check',
  '0 0 * * *', -- Every day at midnight
  'SELECT public.process_expired_subscriptions();'
);
