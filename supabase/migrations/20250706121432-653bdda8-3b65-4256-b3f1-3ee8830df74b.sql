
-- Fix storage bucket access and prevent payment duplicates
-- 1. Update the fawran-screenshots bucket to be public for admin viewing
UPDATE storage.buckets 
SET public = true 
WHERE id = 'fawran-screenshots';

-- 2. Create a policy to allow admins to view all screenshots
CREATE POLICY "Admins can view all fawran screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'fawran-screenshots');

-- 3. Create a unique constraint to prevent duplicate payments from same user with same amount
-- First, let's add a compound index to improve performance and prevent duplicates
CREATE UNIQUE INDEX idx_unique_pending_payment_per_user 
ON public.pending_fawran_payments (user_id, amount, plan_type) 
WHERE status = 'pending';

-- 4. Add a function to handle duplicate payment submissions
CREATE OR REPLACE FUNCTION check_duplicate_payment_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a pending payment for the same plan
  IF EXISTS (
    SELECT 1 FROM public.pending_fawran_payments 
    WHERE user_id = NEW.user_id 
    AND plan_type = NEW.plan_type 
    AND status IN ('pending', 'approved')
    AND id != NEW.id
    AND submitted_at > (now() - INTERVAL '24 hours')
  ) THEN
    RAISE EXCEPTION 'User already has a recent payment submission for this plan type';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to prevent duplicate submissions
DROP TRIGGER IF EXISTS prevent_duplicate_payment_trigger ON public.pending_fawran_payments;
CREATE TRIGGER prevent_duplicate_payment_trigger
  BEFORE INSERT ON public.pending_fawran_payments
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_payment_submission();

-- 6. Add a function to handle the duplicate subscription case
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
