import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, ensurePassport, getCurrentUserId } from "@/integrations/supabase/client";

interface AdminRouteProps {
  children: React.ReactNode;
}

// Simple route guard that:
// 1) Requires a Supabase session
// 2) Calls the secure RPC `is_admin()` to verify admin status
// 3) Redirects non-admins to /mqtr and signs them out
export default function AdminRoute({ children }: AdminRouteProps) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      rootOverflow: root?.style.overflow ?? '',
      rootHeight: root?.style.height ?? '',
    };

    html.style.setProperty('overflow-y', 'auto', 'important');
    html.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
    body.style.setProperty('height', 'auto', 'important');
    if (root) {
      root.style.setProperty('overflow-y', 'auto', 'important');
      root.style.setProperty('height', 'auto', 'important');
    }
    body.classList.add('admin-page');

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      if (root) {
        root.style.overflow = prev.rootOverflow;
        root.style.height = prev.rootHeight;
      }
      body.classList.remove('admin-page');
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      try {
        // Ensure valid session before backend checks (dedupes refresh storms)
        await ensurePassport();

        // 1) Must have a user id
        const userId = await getCurrentUserId();
        if (!userId) {
          if (!isMounted) return;
          setAllowed(false);
          setLoading(false);
          return;
        }

        // 2) Ask backend if this user is an admin
        const { data: isAdmin, error } = await supabase.rpc("is_admin");
        if (error) throw error;

        if (!isMounted) return;
        if (isAdmin === true) {
          setAllowed(true);
        } else {
          // Force sign-out for non-admins
          await supabase.auth.signOut();
          setAllowed(false);
        }
      } catch (e) {
        // Any error -> treat as not allowed
        try { await supabase.auth.signOut(); } catch {}
        if (isMounted) setAllowed(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    check();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        Checking admin access...
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/mqtr" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
