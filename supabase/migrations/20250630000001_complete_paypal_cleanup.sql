
-- Complete PayPal cleanup migration
-- Remove any remaining PayPal-related database objects

-- Drop PayPal webhook if it exists
DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;

-- Remove PayPal-specific columns from profiles if they exist
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS paypal_subscription_id,
DROP COLUMN IF EXISTS paypal_customer_id,
DROP COLUMN IF EXISTS paypal_plan_id;

-- Remove PayPal-specific columns from subscriptions if they exist  
ALTER TABLE public.subscriptions
DROP COLUMN IF EXISTS paypal_subscription_id,
DROP COLUMN IF EXISTS paypal_plan_id,
DROP COLUMN IF EXISTS paypal_customer_id;

-- Drop any PayPal-related functions
DROP FUNCTION IF EXISTS public.process_voice_credits_purchase(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.process_translation_credits_purchase(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.admin_gift_voice_credits(uuid, integer, uuid);
DROP FUNCTION IF EXISTS public.admin_gift_translation_credits(uuid, integer, uuid);

-- Clean up any PayPal webhook entries
DELETE FROM auth.hooks WHERE hook_name LIKE '%paypal%';

-- Log the cleanup
INSERT INTO public.audit_logs (action, table_name, details)
VALUES ('cleanup', 'system', '{"message": "Complete PayPal cleanup performed", "timestamp": "' || now() || '"}');
