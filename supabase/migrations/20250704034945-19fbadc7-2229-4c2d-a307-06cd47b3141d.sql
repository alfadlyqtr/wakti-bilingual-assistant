
-- Fix the gift subscription data for the two users with incorrect expiry dates
-- First, let's get the user IDs for the emails
WITH user_ids AS (
  SELECT id, email 
  FROM profiles 
  WHERE email IN ('jabor2017@icloud.com', 'mohamedbingha974@gmail.com')
)
-- Update profiles table with correct gift subscription info
UPDATE profiles 
SET 
  plan_name = 'Gift 1_week',
  payment_method = 'gift',
  next_billing_date = CASE 
    WHEN email = 'jabor2017@icloud.com' THEN '2025-06-29 13:51:40+00'::timestamp with time zone
    WHEN email = 'mohamedbingha974@gmail.com' THEN '2025-06-30 07:45:43+00'::timestamp with time zone
  END,
  updated_at = now()
WHERE email IN ('jabor2017@icloud.com', 'mohamedbingha974@gmail.com');

-- Update subscriptions table to properly mark as gift subscriptions
UPDATE subscriptions 
SET 
  is_gift = true,
  gift_duration = '1_week',
  plan_name = 'Gift 1_week',
  payment_method = 'gift',
  billing_amount = 0,
  billing_cycle = 'gift',
  next_billing_date = CASE 
    WHEN user_id = (SELECT id FROM profiles WHERE email = 'jabor2017@icloud.com') 
    THEN '2025-06-29 13:51:40+00'::timestamp with time zone
    WHEN user_id = (SELECT id FROM profiles WHERE email = 'mohamedbingha974@gmail.com') 
    THEN '2025-06-30 07:45:43+00'::timestamp with time zone
  END,
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE email IN ('jabor2017@icloud.com', 'mohamedbingha974@gmail.com')
);

-- Add proper admin activity logs for these gift subscriptions
INSERT INTO admin_activity_logs (
  action,
  target_type,
  target_id,
  details
) VALUES 
(
  'gift_subscription_corrected',
  'user',
  (SELECT id::text FROM profiles WHERE email = 'jabor2017@icloud.com'),
  jsonb_build_object(
    'user_email', 'jabor2017@icloud.com',
    'gift_duration', '1_week',
    'corrected_expiry_date', '2025-06-29 13:51:40+00',
    'original_expiry_date', '2025-07-22 13:51:40+00',
    'correction_reason', 'Fixed incorrect 1-month calculation for 1-week gift'
  )
),
(
  'gift_subscription_corrected',
  'user',
  (SELECT id::text FROM profiles WHERE email = 'mohamedbingha974@gmail.com'),
  jsonb_build_object(
    'user_email', 'mohamedbingha974@gmail.com',
    'gift_duration', '1_week',
    'corrected_expiry_date', '2025-06-30 07:45:43+00',
    'original_expiry_date', '2025-07-23 07:45:43+00',
    'correction_reason', 'Fixed incorrect 1-month calculation for 1-week gift'
  )
);
