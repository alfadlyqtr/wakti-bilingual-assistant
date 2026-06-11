import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * PresenceBeacon keeps the current session user online across the whole app.
 * It broadcasts realtime presence and persists profiles.last_seen periodically.
 */
export function PresenceBeacon() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUserId(data.session?.user.id ?? null);
    })();
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const trackPresence = async () => {
      const now = new Date().toISOString();
      try {
        await supabase.from("profiles").update({ last_seen: now }).eq("id", userId);
      } catch {}
    };

    const markOffline = async () => {
      const now = new Date().toISOString();
      try {
        await supabase.from("profiles").update({ last_seen: now }).eq("id", userId);
      } catch {}
    };

    void trackPresence();

    const heartbeat = setInterval(async () => {
      if (document.visibilityState === "visible") {
        await trackPresence();
      }
    }, 15_000);

    const onVisibility = async () => {
      if (document.visibilityState === "visible") {
        await trackPresence();
      } else {
        await markOffline();
      }
    };
    const onPageHide = () => {
      void markOffline();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      void markOffline();
    };
  }, [userId]);

  return null;
}
