-- Chatbot Builder: trial (non-paying) users are VIEW-ONLY.
-- They can open the builder and look around, but cannot create, save,
-- connect, rename, or delete bots until they subscribe.
-- Enforcement = RESTRICTIVE RLS policies that stack on top of the existing
-- permissive "own rows" policies. Service-role (chatbot-engine webhooks)
-- bypasses RLS, so live visitor chats are unaffected.

-- Helper: is this user paid / gifted / on active billing?
CREATE OR REPLACE FUNCTION public.is_vip_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        p.is_subscribed = true
        OR p.admin_gifted = true
        OR (
          p.payment_method IS NOT NULL
          AND btrim(p.payment_method) <> ''
          AND p.payment_method <> 'manual'
          AND p.next_billing_date IS NOT NULL
          AND p.next_billing_date > now()
        )
      )
  );
$$;

-- chatbot_bots
CREATE POLICY "chatbot_bots_insert_requires_vip"
  ON public.chatbot_bots AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_vip_user(auth.uid()));

CREATE POLICY "chatbot_bots_update_requires_vip"
  ON public.chatbot_bots AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_vip_user(auth.uid()))
  WITH CHECK (public.is_vip_user(auth.uid()));

CREATE POLICY "chatbot_bots_delete_requires_vip"
  ON public.chatbot_bots AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_vip_user(auth.uid()));

-- chatbot_flow_nodes
CREATE POLICY "chatbot_flow_nodes_insert_requires_vip"
  ON public.chatbot_flow_nodes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_vip_user(auth.uid()));

CREATE POLICY "chatbot_flow_nodes_update_requires_vip"
  ON public.chatbot_flow_nodes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_vip_user(auth.uid()))
  WITH CHECK (public.is_vip_user(auth.uid()));

CREATE POLICY "chatbot_flow_nodes_delete_requires_vip"
  ON public.chatbot_flow_nodes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_vip_user(auth.uid()));

-- chatbot_flow_edges
CREATE POLICY "chatbot_flow_edges_insert_requires_vip"
  ON public.chatbot_flow_edges AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_vip_user(auth.uid()));

CREATE POLICY "chatbot_flow_edges_update_requires_vip"
  ON public.chatbot_flow_edges AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_vip_user(auth.uid()))
  WITH CHECK (public.is_vip_user(auth.uid()));

CREATE POLICY "chatbot_flow_edges_delete_requires_vip"
  ON public.chatbot_flow_edges AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_vip_user(auth.uid()));
