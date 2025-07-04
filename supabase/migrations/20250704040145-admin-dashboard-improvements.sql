
-- Create function to get comprehensive admin dashboard statistics
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
    
    -- Gift subscriptions (active only)
    (SELECT COUNT(*)::INTEGER FROM subscriptions 
     WHERE is_gift = true AND status = 'active'),
    
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

-- Create function to get Fawran payment system stats
CREATE OR REPLACE FUNCTION public.get_fawran_payment_stats()
RETURNS TABLE(
  total_payments INTEGER,
  pending_payments INTEGER,
  approved_payments INTEGER,
  rejected_payments INTEGER,
  auto_approved_payments INTEGER,
  manual_reviewed_payments INTEGER,
  avg_processing_time_ms NUMERIC,
  tampering_detected_count INTEGER,
  duplicate_detected_count INTEGER,
  time_validation_failed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_payments,
    COUNT(*) FILTER (WHERE status = 'approved')::INTEGER as approved_payments,
    COUNT(*) FILTER (WHERE status = 'rejected')::INTEGER as rejected_payments,
    COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at IS NULL)::INTEGER as auto_approved_payments,
    COUNT(*) FILTER (WHERE status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL)::INTEGER as manual_reviewed_payments,
    COALESCE(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) * 1000), 0) as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE tampering_detected = true)::INTEGER as tampering_detected_count,
    COUNT(*) FILTER (WHERE duplicate_detected = true)::INTEGER as duplicate_detected_count,
    COUNT(*) FILTER (WHERE time_validation_passed = false)::INTEGER as time_validation_failed_count
  FROM pending_fawran_payments;
END;
$$;

-- Create function to get payment method distribution
CREATE OR REPLACE FUNCTION public.get_payment_method_stats()
RETURNS TABLE(
  payment_method TEXT,
  user_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.payment_method, 'manual') as payment_method,
    COUNT(*)::INTEGER as user_count
  FROM profiles p
  WHERE p.is_subscribed = true 
    AND p.subscription_status = 'active'
    AND p.display_name != '[DELETED USER]'
  GROUP BY p.payment_method;
END;
$$;
