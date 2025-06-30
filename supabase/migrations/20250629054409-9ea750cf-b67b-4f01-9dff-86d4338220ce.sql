
-- Create the missing get_user_payment_history function
CREATE OR REPLACE FUNCTION public.get_user_payment_history(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  paypal_subscription_id text,
  paypal_plan_id text,
  plan_name text,
  billing_amount numeric,
  billing_currency text,
  billing_cycle text,
  status text,
  start_date text,
  next_billing_date text,
  created_at text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.paypal_subscription_id,
    s.paypal_plan_id,
    s.plan_name,
    s.billing_amount,
    s.billing_currency,
    s.billing_cycle,
    s.status,
    s.start_date::text,
    s.next_billing_date::text,
    s.created_at::text
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC;
END;
$function$;
