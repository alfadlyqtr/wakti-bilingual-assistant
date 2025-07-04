
-- Fix the gift subscriptions count in admin dashboard stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE(
  total_users INTEGER,
  active_subscriptions INTEGER,
  gift_subscriptions INTEGER,
  expiring_soon INTEGER,
  unsubscribed_users INTEGER,
  unconfirmed_accounts INTEGER,
  monthly_revenue NUMERIC,
  new_users_this_month INTEGER,  
  pending_messages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_of_month DATE := DATE_TRUNC('month', CURRENT_DATE);
  expiry_threshold DATE := CURRENT_DATE + INTERVAL '7 days';
BEGIN
  RETURN QUERY
  SELECT 
    -- Total users (excluding deleted)
    (SELECT COUNT(*)::INTEGER FROM profiles WHERE display_name != '[DELETED USER]'),
    
    -- Active subscriptions
    (SELECT COUNT(*)::INTEGER FROM profiles 
     WHERE is_subscribed = true AND subscription_status = 'active'),
    
    -- Gift subscriptions (active only) - Fixed to count profiles with gift subscriptions
    (SELECT COUNT(*)::INTEGER FROM profiles p
     JOIN subscriptions s ON p.id = s.user_id
     WHERE s.is_gift = true AND s.status = 'active' AND p.is_subscribed = true),
    
    -- Expiring soon (within 7 days)
    (SELECT COUNT(*)::INTEGER FROM profiles 
     WHERE is_subscribed = true 
     AND next_billing_date IS NOT NULL 
     AND next_billing_date::DATE <= expiry_threshold),
    
    -- Unsubscribed users (registered but not subscribed)
    (SELECT COUNT(*)::INTEGER FROM profiles 
     WHERE display_name != '[DELETED USER]' 
     AND (is_subscribed = false OR is_subscribed IS NULL)),
    
    -- Unconfirmed email accounts
    (SELECT COUNT(*)::INTEGER FROM profiles 
     WHERE email_confirmed = false OR email_confirmed IS NULL),
    
    -- Monthly revenue from all active subscriptions
    (SELECT COALESCE(SUM(
      CASE 
        WHEN billing_cycle = 'yearly' THEN billing_amount / 12
        ELSE billing_amount 
      END
    ), 0) FROM subscriptions WHERE status = 'active'),
    
    -- New users this month
    (SELECT COUNT(*)::INTEGER FROM profiles 
     WHERE created_at >= start_of_month 
     AND display_name != '[DELETED USER]'),
    
    -- Pending messages
    (SELECT COUNT(*)::INTEGER FROM contact_submissions WHERE status = 'unread');
END;
$$;
