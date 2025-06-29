
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages() {
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [unreadPerContact, setUnreadPerContact] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Helper to log the current count state
  function logUnreadState(from: string, total: number, perContact: Record<string, number>) {
    console.log(`[useUnreadMessages] Update via ${from}: unreadTotal=${total}, unreadPerContact=`, perContact);
  }

  async function fetchUnread(from: string = 'manual/initial') {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setUnreadPerContact({});
      setUnreadTotal(0);
      setLoading(false);
      logUnreadState(`${from} (no session)`, 0, {});
      return;
    }
    const userId = session.session.user.id;

    // Optimized single query for all unread messages
    const { data, error } = await supabase
      .from("messages")
      .select("sender_id", { count: "exact" })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    const counts: Record<string, number> = {};
    let total = 0;
    if (data) {
      data.forEach((msg: any) => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        total += 1;
      });
    }
    setUnreadPerContact(counts);
    setUnreadTotal(total);
    setLoading(false);
    logUnreadState(from, total, counts);
    if (error) {
      console.error(`[useUnreadMessages] fetchUnread error:`, error);
    }
  }

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    fetchUnread('mount/effect');

    // Realtime updates with optimized settings
    const channel = supabase.channel("messages-unread")
      .on(
        'postgres_changes',
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("[useUnreadMessages] Realtime message event:", payload);
          // Debounce rapid realtime updates
          setTimeout(() => fetchUnread('realtime'), 100);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log('[useUnreadMessages] Realtime channel SUBSCRIBED');
        }
      });

    // Reduced polling frequency for better performance
    pollInterval = setInterval(() => {
      fetchUnread('polling');
    }, 60000); // 60 seconds instead of 30

    // Handle session change edge-cases by listening to Supabase auth state
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchUnread('auth-state-change');
    });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      if (authListener) authListener.subscription.unsubscribe();
    };
  }, []);

  return { unreadTotal, unreadPerContact, loading, refetch: () => fetchUnread('refetch') };
}
