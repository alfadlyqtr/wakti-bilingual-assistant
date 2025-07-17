
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { waktiSounds } from "@/services/waktiSounds";

export function useUnreadMessages() {
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [unreadPerContact, setUnreadPerContact] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number>(0);
  const [eventCount, setEventCount] = useState<number>(0);
  const [contactCount, setContactCount] = useState<number>(0);
  const [sharedTaskCount, setSharedTaskCount] = useState<number>(0);
  const [maw3dEventCount, setMaw3dEventCount] = useState<number>(0);

  // Previous state tracking for notification detection
  const [prevUnreadTotal, setPrevUnreadTotal] = useState<number>(0);
  const [prevTaskCount, setPrevTaskCount] = useState<number>(0);
  const [prevContactCount, setPrevContactCount] = useState<number>(0);
  const [prevSharedTaskCount, setPrevSharedTaskCount] = useState<number>(0);
  const [prevMaw3dEventCount, setPrevMaw3dEventCount] = useState<number>(0);

  // Connection status monitoring
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  function logUnreadState(from: string, total: number, perContact: Record<string, number>) {
    console.log(`[useUnreadMessages] Update via ${from}: unreadTotal=${total}, unreadPerContact=`, perContact);
    console.log(`[useUnreadMessages] Connection status: ${realtimeStatus}`);
  }

  // Separate notification functions for each type
  function checkAndNotifyMessages(newTotal: number, from: string) {
    if (from.includes('realtime') && newTotal > prevUnreadTotal) {
      console.log('🔔 New messages detected, showing notification');
      toast('New Message', {
        description: 'You have new unread messages',
        duration: 4000,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/contacts'
        }
      });
      
      try {
        waktiSounds.playNotificationSound('chime');
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
    setPrevUnreadTotal(newTotal);
  }

  function checkAndNotifyTasks(newTaskCount: number, from: string) {
    if (from.includes('realtime') && newTaskCount > prevTaskCount) {
      console.log('🔔 New overdue tasks detected, showing notification');
      toast('Tasks Overdue', {
        description: 'Some of your tasks have become overdue',
        duration: 4000,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/tr'
        }
      });
      
      try {
        waktiSounds.playNotificationSound('beep');
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
    setPrevTaskCount(newTaskCount);
  }

  function checkAndNotifyContacts(newContactCount: number, from: string) {
    if (from.includes('realtime') && newContactCount > prevContactCount) {
      console.log('🔔 New contact requests detected, showing notification');
      toast('New Contact Request', {
        description: 'You have new contact requests',
        duration: 4000,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/contacts'
        }
      });
      
      try {
        waktiSounds.playNotificationSound('ding');
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
    setPrevContactCount(newContactCount);
  }

  function checkAndNotifySharedTasks(newSharedTaskCount: number, from: string) {
    if (from.includes('realtime') && newSharedTaskCount > prevSharedTaskCount) {
      console.log('🔔 New shared task completions detected, showing notification');
      toast('Shared Task Update', {
        description: 'Someone completed your shared tasks',
        duration: 4000,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/tr'
        }
      });
      
      try {
        waktiSounds.playNotificationSound('chime');
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
    setPrevSharedTaskCount(newSharedTaskCount);
  }

  function checkAndNotifyMaw3dEvents(newMaw3dEventCount: number, from: string) {
    if (from.includes('realtime') && newMaw3dEventCount > prevMaw3dEventCount) {
      console.log('🔔 New event responses detected, showing notification');
      toast('Event Response', {
        description: 'Someone responded to your event',
        duration: 4000,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/maw3d'
        }
      });
      
      try {
        waktiSounds.playNotificationSound('ding');
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
    setPrevMaw3dEventCount(newMaw3dEventCount);
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

      // Check for increases and trigger notifications SEPARATELY for each type
      checkAndNotifyMessages(total, from);
      checkAndNotifyTasks(realTaskCount, from);
      checkAndNotifyContacts(realContactCount, from);
      checkAndNotifySharedTasks(realSharedTaskCount, from);
      checkAndNotifyMaw3dEvents(realMaw3dEventCount, from);

      // Update current state
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

    // Enhanced realtime updates for all relevant tables with connection monitoring
    const channel = supabase.channel("wakti-unified-notifications")
      .on('postgres_changes', { event: "*", schema: "public", table: "messages" }, () => {
        console.log("[useUnreadMessages] Messages updated (REAL-TIME)");
        fetchUnread('realtime-messages');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "my_tasks" }, () => {
        console.log("[useUnreadMessages] Tasks updated (REAL-TIME)");
        fetchUnread('realtime-tasks');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "shared_task_completions" }, () => {
        console.log("[useUnreadMessages] Shared task completions updated (REAL-TIME)");
        fetchUnread('realtime-shared-tasks');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "maw3d_rsvps" }, () => {
        console.log("[useUnreadMessages] Maw3d RSVPs updated (REAL-TIME)");
        fetchUnread('realtime-maw3d');
      })
      .on('postgres_changes', { event: "*", schema: "public", table: "contacts" }, () => {
        console.log("[useUnreadMessages] Contacts updated (REAL-TIME)");
        fetchUnread('realtime-contacts');
      })
      .subscribe((status) => {
        console.log(`[useUnreadMessages] Realtime channel status: ${status}`);
        if (status === "SUBSCRIBED") {
          setRealtimeStatus('connected');
          console.log('✅ Unified notification system SUBSCRIBED successfully');
        } else if (status === "CHANNEL_ERROR") {
          setRealtimeStatus('error');
          console.error('❌ Unified notification system channel error');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    // Reduced polling frequency since we now have real-time for everything
    pollInterval = setInterval(() => {
      console.log('[useUnreadMessages] Fallback polling (should be rare now)');
      fetchUnread('polling-fallback');
    }, 60000); // Increased to 60s since real-time should handle most updates

    // Auth state change handler
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, _session) => {
      fetchUnread('auth-state-change');
    });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      if (authListener) authListener.subscription.unsubscribe();
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
    realtimeStatus,
    refetch: () => fetchUnread('refetch') 
  };
}
