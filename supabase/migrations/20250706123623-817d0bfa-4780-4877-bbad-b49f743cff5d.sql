
-- Create the missing resolve_duplicate_subscription database function
CREATE OR REPLACE FUNCTION resolve_duplicate_subscription(
  p_user_email text,
  p_keep_payment_id uuid,
  p_refund_payment_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  -- Get user ID
  SELECT user_id INTO v_user_id 
  FROM public.pending_fawran_payments 
  WHERE email = p_user_email 
  LIMIT 1;
  
  -- Mark the refund payment as refunded
  UPDATE public.pending_fawran_payments
  SET 
    status = 'refunded',
    review_notes = jsonb_build_object(
      'refunded', true,
      'reason', 'duplicate_payment',
      'kept_payment_id', p_keep_payment_id,
      'processed_at', now(),
      'admin_action', true
    ),
    reviewed_at = now()
  WHERE id = p_refund_payment_id;
  
  -- Log the action
  INSERT INTO public.admin_activity_logs (
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    'resolve_duplicate_payment',
    'fawran_payment',
    p_refund_payment_id::text,
    jsonb_build_object(
      'user_email', p_user_email,
      'kept_payment_id', p_keep_payment_id,
      'refunded_payment_id', p_refund_payment_id,
      'processed_at', now()
    )
  );
  
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'kept_payment_id', p_keep_payment_id,
    'refunded_payment_id', p_refund_payment_id,
    'processed_at', now()
  );
  
  RETURN v_result;
END;
$function$;

-- Create queue_notification function if it doesn't exist
CREATE OR REPLACE FUNCTION queue_notification(
  p_user_id uuid,
  p_notification_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}',
  p_deep_link text DEFAULT NULL,
  p_scheduled_for timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO public.notification_queue (
    user_id,
    notification_type,
    title,
    body,
    data,
    deep_link,
    scheduled_for
  ) VALUES (
    p_user_id,
    p_notification_type,
    p_title,
    p_body,
    p_data,
    p_deep_link,
    p_scheduled_for
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;
