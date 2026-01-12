-- Enhanced Project Backend Tables

-- Shopping carts for site users
CREATE TABLE public.project_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  site_user_id UUID REFERENCES public.project_site_users(id) ON DELETE CASCADE,
  session_id TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders with buyer info
CREATE TABLE public.project_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  site_user_id UUID REFERENCES public.project_site_users(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  buyer_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory tracking per collection item
CREATE TABLE public.project_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  collection_name TEXT NOT NULL,
  collection_item_id UUID NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  track_inventory BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, collection_item_id)
);

-- Bookings with WAKTI calendar sync
CREATE TABLE public.project_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  site_user_id UUID REFERENCES public.project_site_users(id) ON DELETE SET NULL,
  maw3d_event_id UUID REFERENCES public.maw3d_events(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'pending',
  customer_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat rooms for real-time messaging
CREATE TABLE public.project_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT DEFAULT 'direct',
  participants JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comments on any item type
CREATE TABLE public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  site_user_id UUID REFERENCES public.project_site_users(id) ON DELETE SET NULL,
  author_name TEXT,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Owner notifications for orders/bookings
CREATE TABLE public.project_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams for SaaS grouping
CREATE TABLE public.project_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add SaaS columns to project_site_users
ALTER TABLE public.project_site_users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.project_teams(id) ON DELETE SET NULL;

-- Add chat enhancements to project_chat_messages
ALTER TABLE public.project_chat_messages
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.project_chat_rooms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.project_site_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_carts_project ON public.project_carts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_carts_session ON public.project_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_project_orders_project ON public.project_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_orders_status ON public.project_orders(status);
CREATE INDEX IF NOT EXISTS idx_project_bookings_project ON public.project_bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_bookings_date ON public.project_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_project_bookings_owner ON public.project_bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_item ON public.project_comments(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_project_notifications_user ON public.project_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_project_chat_rooms_project ON public.project_chat_rooms(project_id);

-- Enable RLS on all new tables
ALTER TABLE public.project_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_carts
CREATE POLICY "Project owners can manage carts" ON public.project_carts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- RLS Policies for project_orders
CREATE POLICY "Project owners can manage orders" ON public.project_orders
  FOR ALL USING (owner_id = auth.uid());

-- RLS Policies for project_inventory
CREATE POLICY "Project owners can manage inventory" ON public.project_inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- RLS Policies for project_bookings
CREATE POLICY "Project owners can manage bookings" ON public.project_bookings
  FOR ALL USING (owner_id = auth.uid());

-- RLS Policies for project_chat_rooms
CREATE POLICY "Project owners can manage chat rooms" ON public.project_chat_rooms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- RLS Policies for project_comments
CREATE POLICY "Project owners can manage comments" ON public.project_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- RLS Policies for project_notifications
CREATE POLICY "Users can view their own notifications" ON public.project_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.project_notifications
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for project_teams
CREATE POLICY "Project owners can manage teams" ON public.project_teams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Enable Supabase Realtime for real-time features
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_notifications;