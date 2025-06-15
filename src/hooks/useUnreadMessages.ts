
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages() {
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [unreadPerContact, setUnreadPerContact] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function fetchUnread() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const userId = session.session.user.id;

    // get per contact unread
    const { data, error } = await supabase
      .from("messages")
      .select("sender_id, is_read", { count: "exact" })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    // Compute per contact count
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
  }

  useEffect(() => {
    fetchUnread();
    // Realtime updates
    const channel = supabase.channel("messages-unread")
      .on(
        'postgres_changes',
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => fetchUnread()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { unreadTotal, unreadPerContact, loading, refetch: fetchUnread };
}
