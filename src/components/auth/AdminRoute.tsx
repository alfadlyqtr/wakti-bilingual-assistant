import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
    let isMounted = true;

    const check = async () => {
      try {
        // 1) Must have a session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const session = sessionData.session;
        if (!session) {
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
