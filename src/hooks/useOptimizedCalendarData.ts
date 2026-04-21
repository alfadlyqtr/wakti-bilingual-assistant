
import { useState, useEffect, useCallback, useRef } from "react";
import { getCalendarEntries, CalendarEntry } from "@/utils/calendarUtils";
import { useDebounced } from "./useDebounced";
import { useCalendarData } from "./useCalendarData";
import { useAuth } from "@/contexts/AuthContext";
import { emitEvent, onEvent } from "@/utils/eventBus";
import { JournalService } from "@/services/journalService";
import { retrieveCalendarEventsIfSupported } from "@/integrations/natively/calendarBridge";

type CalendarExtrasSnapshot = {
  journalOverlay: { date: string; mood_value: number | null }[];
  phoneCalendarEvents: { id?: string; title: string; startDate: string; endDate: string }[];
  timestamp: number;
};

const calendarExtrasCache = new Map<string, CalendarExtrasSnapshot>();

const CACHE_TTL = 15 * 1000; // Restore the faster 15s TTL for extras

export function useOptimizedCalendarData() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const {
    manualEntries,
    maw3dEvents,
    tasks,
    reminders,
    projectCalendarEntries,
    loading: baseLoading,
    refresh: refreshBaseData,
    setManualEntries
  } = useCalendarData();
  const [journalOverlay, setJournalOverlay] = useState<{ date: string; mood_value: number | null }[]>([]);
  const [phoneCalendarEvents, setPhoneCalendarEvents] = useState<
    { id?: string; title: string; startDate: string; endDate: string }[]
  >([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const fetchExtras = useCallback(async (force = false) => {
    if (fetchingRef.current && !force) {
      return;
    }

    const now = Date.now();
    const cachedExtras = userId ? calendarExtrasCache.get(userId) : null;

    if (!force && cachedExtras && (now - cachedExtras.timestamp) < CACHE_TTL) {
      setJournalOverlay(cachedExtras.journalOverlay || []);
      setPhoneCalendarEvents(cachedExtras.phoneCalendarEvents || []);
      setLoadingExtras(false);
      return;
    }

    if (!userId) {
      setJournalOverlay([]);
      setPhoneCalendarEvents([]);
      setLoadingExtras(false);
      return;
    }

    try {
      fetchingRef.current = true;
      setLoadingExtras(true);

      const [journalDays, phoneEventsResult] = await Promise.all([
        JournalService.getCalendarOverlay(60),
        new Promise<{ status: string; data?: { id?: string; title: string; startDate: string; endDate: string }[] }>((resolve) => {
          retrieveCalendarEventsIfSupported((result) => resolve(result));
        })
      ]);

      if (!mountedRef.current) return;

      const phoneEvents = phoneEventsResult.status === 'SUCCESS' && phoneEventsResult.data
        ? phoneEventsResult.data
        : [];

      calendarExtrasCache.set(userId, {
        journalOverlay: journalDays || [],
        phoneCalendarEvents: phoneEvents,
        timestamp: now
      });

      setJournalOverlay(journalDays || []);
      setPhoneCalendarEvents(phoneEvents);
      
      // Notify other same-tab hooks that new extra data is available
      emitEvent('wakti-calendar-extras-update', { userId });
    } catch (error) {
      console.error('Error fetching calendar extras:', error);
    } finally {
      if (mountedRef.current) {
        setLoadingExtras(false);
      }
      fetchingRef.current = false;
    }
  }, [userId]);

  // Debounced refresh
  const debouncedRefresh = useDebounced(() => {
    void refresh();
  }, 1000);

  const refresh = useCallback(async () => {
    if (userId) {
      calendarExtrasCache.delete(userId);
    }
    await Promise.all([
      refreshBaseData(),
      fetchExtras(true)
    ]);
  }, [fetchExtras, refreshBaseData, userId]);

  // Initial load and sync listener
  useEffect(() => {
    mountedRef.current = true;
    fetchExtras();
    
    if (!userId) return;
    
    // Listen for same-tab sync events (when another hook fetches fresh extra data)
    const unsubExtras = onEvent('wakti-calendar-extras-update', (detail) => {
      if (detail?.userId === userId) {
        const cached = calendarExtrasCache.get(userId);
        if (cached) {
          setJournalOverlay(cached.journalOverlay || []);
          setPhoneCalendarEvents(cached.phoneCalendarEvents || []);
          setLoadingExtras(false);
        }
      }
    });
    
    return () => {
      mountedRef.current = false;
      unsubExtras();
    };
  }, [fetchExtras, userId]);

  // Recompute entries when data changes
  useEffect(() => {
    getCalendarEntries(
      manualEntries,
      [],
      maw3dEvents,
      tasks,
      reminders,
      journalOverlay,
      projectCalendarEntries,
      phoneCalendarEvents
    )
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [manualEntries, maw3dEvents, tasks, reminders, journalOverlay, projectCalendarEntries, phoneCalendarEvents]);

  return {
    loading: baseLoading || loadingExtras,
    entries,
    manualEntries,
    maw3dEvents,
    tasks,
    reminders,
    journalOverlay,
    projectCalendarEntries,
    phoneCalendarEvents,
    refresh,
    debouncedRefresh,
    setManualEntries
  };
}
