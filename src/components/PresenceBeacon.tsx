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

    const channel = supabase.channel("online-users", {
      config: {
        presence: { key: userId }
      }
    });

    const trackPresence = async () => {
      const now = new Date().toISOString();
      try {
        await channel.track({ user_id: userId, typing: false, last_seen: now });
      } catch {}
      try {
        await supabase.from("profiles").update({ last_seen: now }).eq("id", userId);
      } catch {}
    };

    const onSubscribed = async (status: string) => {
      if (status === "SUBSCRIBED") {
        await trackPresence();
      }
    };

    channel.subscribe(onSubscribed as any);

    const heartbeat = setInterval(async () => {
      if (document.visibilityState === "visible") {
        await trackPresence();
      }
    }, 30_000);

    const onVisibility = async () => {
      if (document.visibilityState === "visible") {
        await trackPresence();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [userId]);

  return null;
}
