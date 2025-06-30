
-- Protect and maintain legacy PayPal users
-- These users paid through PayPal before the Fawran system and should remain active

DO $$ 
DECLARE
    legacy_emails text[] := ARRAY[
        'ahmadalsayyed40@gmail.com',
        'alfadly@tmw.qa', 
        'albuhaddoudhilal@gmail.com',
        'alanoud.qtr6@gmail.com',
        'mohamedbingha974@gmail.com'
    ];
    email_item text;
    user_record RECORD;
BEGIN
    -- Loop through each legacy email
    FOREACH email_item IN ARRAY legacy_emails
    LOOP
        -- Find the user by email
        SELECT id, is_subscribed, subscription_status, payment_method
        INTO user_record
        FROM public.profiles 
        WHERE email = email_item;
        
        IF FOUND THEN
            -- Update the user to ensure they remain active with legacy PayPal status
            UPDATE public.profiles
            SET 
                is_subscribed = true,
                subscription_status = 'active',
                payment_method = 'paypal',
                plan_name = COALESCE(plan_name, 'Legacy PayPal Plan'),
                updated_at = now()
            WHERE id = user_record.id;
            
            -- Ensure they have a subscription record
            INSERT INTO public.subscriptions (
                user_id,
                paypal_subscription_id,
                status,
                plan_name,
                billing_amount,
                billing_currency,
                billing_cycle,
                start_date,
                next_billing_date,
                payment_method
            ) VALUES (
                user_record.id,
                'LEGACY-PAYPAL-' || user_record.id::text,
                'active',
                'Legacy PayPal Plan',
                60,
                'QAR',
                'monthly',
                COALESCE((SELECT billing_start_date FROM public.profiles WHERE id = user_record.id), now()),
                COALESCE((SELECT next_billing_date FROM public.profiles WHERE id = user_record.id), now() + INTERVAL '1 month'),
                'paypal'
            )
            ON CONFLICT (user_id) DO UPDATE SET
                status = 'active',
                payment_method = 'paypal',
                updated_at = now();
                
            RAISE NOTICE 'Protected legacy PayPal user: %', email_item;
        ELSE
            RAISE NOTICE 'Legacy PayPal user not found: %', email_item;
        END IF;
    END LOOP;
END $$;

-- Add a comment to document this protection
COMMENT ON TABLE public.profiles IS 'User profiles table. Legacy PayPal users (5 specified emails) are protected from deactivation and maintain active subscriptions.';

-- Create a function to check if a user is a protected legacy PayPal user
CREATE OR REPLACE FUNCTION public.is_legacy_paypal_user(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    legacy_emails text[] := ARRAY[
        'ahmadalsayyed40@gmail.com',
        'alfadly@tmw.qa', 
        'albuhaddoudhilal@gmail.com',
        'alanoud.qtr6@gmail.com',
        'mohamedbingha974@gmail.com'
    ];
BEGIN
    RETURN user_email = ANY(legacy_emails);
END;
$function$;
