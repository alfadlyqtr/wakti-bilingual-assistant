
-- Remove the interfering trigger that sends database events to PayPal webhook
DROP TRIGGER IF EXISTS update_subscriptions_updated_at_trigger ON public.subscriptions;

-- Create a simple updated_at function that doesn't interfere with webhooks
CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a new trigger that only updates the timestamp without external calls
CREATE TRIGGER update_subscriptions_updated_at_trigger
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Add index for better PayPal subscription lookup performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_subscription_id 
ON public.subscriptions(paypal_subscription_id);

-- Add index for user subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status 
ON public.subscriptions(user_id, status);
