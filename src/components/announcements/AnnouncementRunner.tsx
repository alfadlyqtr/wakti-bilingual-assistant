import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AnnouncementRuntime, matchesRoute, type PendingAnnouncement } from '@/services/AnnouncementRuntime';
import { AnnouncementService } from '@/services/AnnouncementService';
import { AnnouncementPopup } from './AnnouncementPopup';
import { AnnouncementBanner } from './AnnouncementBanner';
import { useTheme } from '@/providers/ThemeProvider';

const EXCLUDED_PREFIXES = ['/login', '/mqtr', '/admin', '/admin-setup', '/admindash', '/admin-settings'];
const FIRST_LOGIN_KEY_PREFIX = 'wakti_first_login_seen_';

export function AnnouncementRunner() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useTheme();

  const [pending, setPending] = useState<PendingAnnouncement[]>([]);
  const [active, setActive] = useState<PendingAnnouncement | null>(null);
  const recordedRef = useRef<Set<string>>(new Set());
  const toastShownRef = useRef<Set<string>>(new Set());
  const lastFetchRef = useRef<number>(0);

  const isAdminRoute = useMemo(() => EXCLUDED_PREFIXES.some((p) => location.pathname.startsWith(p)), [location.pathname]);

  const refreshPending = async (force = false) => {
    if (!user?.id) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 15_000) return;
    lastFetchRef.current = now;
    try {
      const rows = await AnnouncementRuntime.getPending();
      setPending(rows);
    } catch {}
  };

  useEffect(() => {
    if (loading || !user?.id) {
      setPending([]);
      setActive(null);
      lastFetchRef.current = 0;
      return;
    }
    void refreshPending(true);
  }, [loading, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const handler = () => { void refreshPending(true); };
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const localUnsub = AnnouncementRuntime.onRefresh(() => { void refreshPending(true); });
    const realtimeUnsub = AnnouncementRuntime.subscribe(user.id, () => { void refreshPending(true); });
    return () => {
      localUnsub();
      realtimeUnsub();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (isAdminRoute) return;
    if (active) return;
    if (pending.length === 0) return;

    const path = location.pathname;
    const isFirstLoginForThisSession = (() => {
      try {
        const key = `${FIRST_LOGIN_KEY_PREFIX}${user.id}`;
        const already = sessionStorage.getItem(key) === '1';
        if (!already) sessionStorage.setItem(key, '1');
        return !already;
      } catch {
        return false;
      }
    })();

    const candidate = pending.find((a) => {
      if (!matchesRoute(path, a.include_routes, a.exclude_routes)) return false;
      if (a.trigger_type === 'on_first_login' && !isFirstLoginForThisSession) return false;
      if (a.trigger_type === 'on_event') return false;
      return true;
    });

    if (!candidate) return;

    const delay = Math.max(0, (candidate.delay_seconds || 0) * 1000);
    const timer = window.setTimeout(() => {
      void handleDisplay(candidate);
    }, delay || 250);

    return () => window.clearTimeout(timer);
  }, [user?.id, isAdminRoute, pending, active, location.pathname]);

  const handleDisplay = async (a: PendingAnnouncement) => {
    if (!user?.id) return;

    if (!recordedRef.current.has(a.id)) {
      recordedRef.current.add(a.id);
      void AnnouncementRuntime.recordShown(a.id);
      void AnnouncementService.mark(user.id, a.announcement_key, 'seen');
    }

    if (a.display_type === 'toast') {
      if (toastShownRef.current.has(a.id)) return;
      toastShownRef.current.add(a.id);
      const isAr = language === 'ar';
      const title = (isAr ? a.title_ar : a.title_en) || a.title_en || a.title_ar || '';
      const body  = (isAr ? a.body_ar  : a.body_en)  || a.body_en  || a.body_ar  || '';
      const ctaLabel = a.cta_enabled
        ? ((isAr ? a.cta_label_ar : a.cta_label_en) || (isAr ? 'فتح' : 'Open'))
        : null;

      toast.message(title || body, {
        description: title ? body : undefined,
        duration: 8000,
        action: ctaLabel
          ? { label: ctaLabel, onClick: () => void handleAct(a) }
          : undefined,
        onDismiss: () => void handleDismiss(a),
        onAutoClose: () => void handleDismiss(a),
      });
      setPending((prev) => prev.filter((x) => x.id !== a.id));
      return;
    }

    setActive(a);
  };

  const handleAct = async (a: PendingAnnouncement) => {
    if (!user?.id) return;
    await AnnouncementService.mark(user.id, a.announcement_key, 'acted');
    setPending((prev) => prev.filter((x) => x.id !== a.id));
    setActive((cur) => (cur?.id === a.id ? null : cur));

    if (a.cta_action_type === 'url' && a.cta_action_value) {
      try { window.open(a.cta_action_value, '_blank', 'noopener'); } catch {}
    } else if (a.cta_action_type === 'navigate' && a.cta_action_value) {
      try { navigate(a.cta_action_value); } catch {}
    } else if (a.cta_action_type === 'event' && a.cta_action_value) {
      try { window.dispatchEvent(new CustomEvent(a.cta_action_value)); } catch {}
    }
  };

  const handleDismiss = async (a: PendingAnnouncement) => {
    if (!user?.id) return;
    await AnnouncementService.mark(user.id, a.announcement_key, 'dismissed');
    setPending((prev) => prev.filter((x) => x.id !== a.id));
    setActive((cur) => (cur?.id === a.id ? null : cur));
  };

  if (!user?.id || isAdminRoute) return null;

  if (active?.display_type === 'banner') {
    return (
      <AnnouncementBanner
        announcement={active}
        onAction={() => void handleAct(active)}
        onDismiss={() => void handleDismiss(active)}
      />
    );
  }

  return (
    <AnnouncementPopup
      announcement={active}
      open={!!active && active.display_type === 'popup'}
      onAction={() => active && void handleAct(active)}
      onDismiss={() => active && void handleDismiss(active)}
    />
  );
}
