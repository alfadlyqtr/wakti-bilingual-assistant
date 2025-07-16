import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { waktiNotifications } from '@/services/waktiNotifications';

export function useUnreadMessages() {
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [unreadPerContact, setUnreadPerContact] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [eventCount, setEventCount] = useState<number>(0);
  const [contactCount, setContactCount] = useState<number>(0);
  const [sharedTaskCount, setSharedTaskCount] = useState<number>(0);
  const [previousCounts, setPreviousCounts] = useState<{
    unread: number;
    task: number;
    event: number;
    contact: number;
    sharedTask: number;
  }>({ unread: 0, task: 0, event: 0, contact: 0, sharedTask: 0 });

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

    const { data, error } = await supabase
      .from("messages")
      .select("sender_id, is_read", { count: "exact" })
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

  // Trigger notifications when counts increase
  useEffect(() => {
    const current = { 
      unread: unreadTotal, 
      task: taskCount, 
      event: eventCount, 
      contact: contactCount, 
      sharedTask: sharedTaskCount
    };
    
    if (previousCounts.unread >= 0 && previousCounts.unread !== current.unread) {
      if (current.unread > previousCounts.unread) {
        const newMessages = current.unread - previousCounts.unread;
        setTimeout(() => {
          waktiNotifications.showNotification({
            type: 'message',
            title: 'New Message',
            message: `You have ${newMessages} new message${newMessages > 1 ? 's' : ''}`
          });
        }, 200);
      }
    }
    
    setPreviousCounts(current);
  }, [unreadTotal, taskCount, eventCount, contactCount, sharedTaskCount]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    fetchUnread('mount/effect');

    // Realtime updates
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
          fetchUnread('realtime');
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log('[useUnreadMessages] Realtime channel SUBSCRIBED');
        }
      });

    // Fallback polling if realtime fails (every 30s)
    pollInterval = setInterval(() => {
      fetchUnread('polling');
    }, 30000);

    // Debug: enable manual refresh in window for devs
    if (typeof window !== "undefined") {
      (window as any).debugRefetchUnreadMessages = () => fetchUnread('debug/manual');
    }

    // Handle session change edge-cases by listening to Supabase auth state
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchUnread('auth-state-change');
    });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      if (authListener) authListener.subscription.unsubscribe();
    };
    // No deps: only attach on mount.
  }, []);

  return { 
    unreadTotal, 
    unreadPerContact, 
    taskCount,
    eventCount, 
    contactCount,
    sharedTaskCount,
    loading, 
    refetch: () => fetchUnread('refetch') 
  };
}
