
-- Fix avatar storage bucket policies to allow authenticated users to upload their own avatars
CREATE POLICY "Authenticated users can upload their own avatars"
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can update their own avatars"
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Authenticated users can delete their own avatars"
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Update nouf_mr@yahoo.com subscription to "Paid Cash/Bank Transfer 60 QAR Monthly"
UPDATE public.profiles 
SET 
  is_subscribed = true,
  subscription_status = 'active',
  plan_name = 'Paid Cash/Bank Transfer 60 QAR Monthly',
  billing_start_date = now(),
  next_billing_date = now() + INTERVAL '1 month',
  updated_at = now()
WHERE email = 'nouf_mr@yahoo.com';

-- Insert subscription record for nouf_mr@yahoo.com
INSERT INTO public.subscriptions (
  user_id,
  paypal_subscription_id,
  paypal_plan_id,
  status,
  plan_name,
  billing_amount,
  billing_currency,
  billing_cycle,
  start_date,
  next_billing_date
)
SELECT 
  id,
  'CASH-BANK-TRANSFER-' || extract(epoch from now())::text,
  'CASH-BANK-TRANSFER',
  'active',
  'Paid Cash/Bank Transfer 60 QAR Monthly',
  60,
  'QAR',
  'monthly',
  now(),
  now() + INTERVAL '1 month'
FROM public.profiles 
WHERE email = 'nouf_mr@yahoo.com'
ON CONFLICT DO NOTHING;
