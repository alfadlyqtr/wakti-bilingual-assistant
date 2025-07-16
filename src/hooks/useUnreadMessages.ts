
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages() {
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [unreadPerContact, setUnreadPerContact] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [eventCount, setEventCount] = useState<number>(0);
  const [contactCount, setContactCount] = useState<number>(0);
  const [sharedTaskCount, setSharedTaskCount] = useState<number>(0);
  const [maw3dEventCount, setMaw3dEventCount] = useState<number>(0);

  function logUnreadState(from: string, total: number, perContact: Record<string, number>) {
    console.log(`[useUnreadMessages] Update via ${from}: unreadTotal=${total}, unreadPerContact=`, perContact);
  }

  async function fetchUnread(from: string = 'manual/initial') {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setUnreadPerContact({});
      setUnreadTotal(0);
      setTaskCount(0);
      setEventCount(0);
      setContactCount(0);
      setSharedTaskCount(0);
      setMaw3dEventCount(0);
      setLoading(false);
      logUnreadState(`${from} (no session)`, 0, {});
      return;
    }
    const userId = session.session.user.id;

    try {
      // Fetch REAL unread messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("sender_id, is_read")
        .eq("recipient_id", userId)
        .eq("is_read", false);

      if (messagesError) throw messagesError;

      const counts: Record<string, number> = {};
      let total = 0;
      if (messagesData) {
        messagesData.forEach((msg: any) => {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
          total += 1;
        });
      }

      // Fetch REAL overdue tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("my_tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "overdue");

      const realTaskCount = tasksData ? tasksData.length : 0;

      // Fetch REAL pending contact requests
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_id", userId)
        .eq("status", "pending");

      const realContactCount = contactsData ? contactsData.length : 0;

      // Fetch REAL shared task completions (last 24h)
      const { data: sharedData, error: sharedError } = await supabase
        .from("shared_task_completions")
        .select(`
          task_id,
          my_tasks!inner(user_id)
        `)
        .eq("my_tasks.user_id", userId)
        .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const realSharedTaskCount = sharedData ? sharedData.length : 0;

      // Fetch REAL Maw3d RSVP responses for user's events (last 24h)
      const { data: maw3dData, error: maw3dError } = await supabase
        .from("maw3d_rsvps")
        .select(`
          event_id,
          maw3d_events!inner(created_by)
        `)
        .eq("maw3d_events.created_by", userId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const realMaw3dEventCount = maw3dData ? maw3dData.length : 0;

      setUnreadPerContact(counts);
      setUnreadTotal(total);
      setTaskCount(realTaskCount);
      setEventCount(0);
      setContactCount(realContactCount);
      setSharedTaskCount(realSharedTaskCount);
      setMaw3dEventCount(realMaw3dEventCount);
      setLoading(false);
      logUnreadState(from, total, counts);

    } catch (error) {
      console.error('[useUnreadMessages] Error:', error);
      setUnreadPerContact({});
      setUnreadTotal(0);
      setTaskCount(0);
      setEventCount(0);
      setContactCount(0);
      setSharedTaskCount(0);
      setMaw3dEventCount(0);
      setLoading(false);
      logUnreadState(`${from} (error)`, 0, {});
    }
  }

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    fetchUnread('mount/effect');

    // Realtime updates for all relevant tables
    const channel = supabase.channel("wakti-notifications")
      .on('postgres_changes', { event: "*", schema: "public", table: "messages" }, () => {
        console.log("[useUnreadMessages] Messages updated");
        fetchUnread('realtime-messages');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "shared_task_completions" }, () => {
        console.log("[useUnreadMessages] Shared task completions updated");
        fetchUnread('realtime-shared-tasks');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "maw3d_rsvps" }, () => {
        console.log("[useUnreadMessages] Maw3d RSVPs updated");
        fetchUnread('realtime-maw3d');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "contacts" }, () => {
        console.log("[useUnreadMessages] Contacts updated");
        fetchUnread('realtime-contacts');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "my_tasks" }, () => {
        console.log("[useUnreadMessages] Tasks updated");
        fetchUnread('realtime-tasks');
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log('[useUnreadMessages] Realtime channel SUBSCRIBED');
        }
      });

    // Listen for WN1 notification events to refresh counts
    const handleWN1Notification = () => {
      console.log("[useUnreadMessages] WN1 notification received, refreshing counts");
      fetchUnread('wn1-notification');
    };

    window.addEventListener('wn1-notification-received', handleWN1Notification);

    // Fallback polling every 30s
    pollInterval = setInterval(() => {
      fetchUnread('polling');
    }, 30000);

    // Auth state change handler
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchUnread('auth-state-change');
    });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      if (authListener) authListener.subscription.unsubscribe();
      window.removeEventListener('wn1-notification-received', handleWN1Notification);
    };
  }, []);

  return { 
    unreadTotal, 
    unreadPerContact, 
    taskCount,
    eventCount, 
    contactCount,
    sharedTaskCount,
    maw3dEventCount,
    loading, 
    refetch: () => fetchUnread('refetch') 
  };
}
