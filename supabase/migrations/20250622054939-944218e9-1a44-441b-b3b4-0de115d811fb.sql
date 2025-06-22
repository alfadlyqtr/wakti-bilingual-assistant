
-- Create admin users table (separate from regular users)
CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create contact submissions table
CREATE TABLE public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  status text DEFAULT 'unread',
  admin_response text,
  responded_by uuid REFERENCES admin_users(id),
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create admin sessions table for session management
CREATE TABLE public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create admin activity logs
CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin tables (admins can access everything)
CREATE POLICY "Admin users can manage admin accounts" ON public.admin_users FOR ALL USING (true);
CREATE POLICY "Admin users can manage contact submissions" ON public.contact_submissions FOR ALL USING (true);
CREATE POLICY "Admin users can manage sessions" ON public.admin_sessions FOR ALL USING (true);
CREATE POLICY "Admin users can view activity logs" ON public.admin_activity_logs FOR ALL USING (true);

-- Create functions for admin authentication
CREATE OR REPLACE FUNCTION public.authenticate_admin(p_email text, p_password text)
RETURNS TABLE(admin_id uuid, session_token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
  v_password_hash text;
  v_session_token text;
  v_expires_at timestamp with time zone;
BEGIN
  -- Get admin user and password hash
  SELECT id, password_hash INTO v_admin_id, v_password_hash
  FROM public.admin_users 
  WHERE email = p_email AND is_active = true;
  
  -- Check if admin exists and password matches (simplified - in production use proper hashing)
  IF v_admin_id IS NULL OR v_password_hash != crypt(p_password, v_password_hash) THEN
    RETURN;
  END IF;
  
  -- Generate session token
  v_session_token := encode(gen_random_bytes(32), 'base64');
  v_expires_at := now() + INTERVAL '24 hours';
  
  -- Create session
  INSERT INTO public.admin_sessions (admin_user_id, session_token, expires_at)
  VALUES (v_admin_id, v_session_token, v_expires_at);
  
  -- Update last login
  UPDATE public.admin_users SET last_login_at = now() WHERE id = v_admin_id;
  
  RETURN QUERY SELECT v_admin_id, v_session_token, v_expires_at;
END;
$$;

-- Function to validate admin session
CREATE OR REPLACE FUNCTION public.validate_admin_session(p_session_token text)
RETURNS TABLE(admin_id uuid, email text, full_name text, role text, permissions jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email, au.full_name, au.role, au.permissions
  FROM public.admin_users au
  JOIN public.admin_sessions asess ON au.id = asess.admin_user_id
  WHERE asess.session_token = p_session_token 
    AND asess.expires_at > now()
    AND au.is_active = true;
END;
$$;

-- Function to manually activate subscription (for PayPal webhook workaround)
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(
  p_user_id uuid,
  p_plan_name text,
  p_billing_amount numeric DEFAULT 60,
  p_billing_currency text DEFAULT 'QAR'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date timestamp with time zone := now();
  v_next_billing_date timestamp with time zone;
BEGIN
  -- Calculate next billing date based on plan
  IF p_plan_name ILIKE '%yearly%' OR p_plan_name ILIKE '%year%' THEN
    v_next_billing_date := v_start_date + INTERVAL '1 year';
  ELSE
    v_next_billing_date := v_start_date + INTERVAL '1 month';
  END IF;
  
  -- Update profile
  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscription_status = 'active',
    plan_name = p_plan_name,
    billing_start_date = v_start_date,
    next_billing_date = v_next_billing_date,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Create subscription record
  INSERT INTO public.subscriptions (
    user_id,
    paypal_subscription_id,
    status,
    plan_name,
    billing_amount,
    billing_currency,
    billing_cycle,
    start_date,
    next_billing_date
  ) VALUES (
    p_user_id,
    'ADMIN-MANUAL-' || extract(epoch from now())::text,
    'active',
    p_plan_name,
    p_billing_amount,
    p_billing_currency,
    CASE WHEN p_plan_name ILIKE '%yearly%' THEN 'yearly' ELSE 'monthly' END,
    v_start_date,
    v_next_billing_date
  );
  
  RETURN true;
END;
$$;

-- Insert initial admin user (password: admin123 - change this!)
INSERT INTO public.admin_users (email, password_hash, full_name, role, permissions)
VALUES (
  'admin@wakti.qa',
  crypt('admin123', gen_salt('bf')),
  'Super Admin',
  'super_admin',
  '{"user_management": true, "subscription_management": true, "quota_management": true, "contact_management": true}'
);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.update_admin_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_updated_at();

CREATE TRIGGER update_contact_submissions_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_updated_at();
