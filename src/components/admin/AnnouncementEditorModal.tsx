// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Search, Plus, Megaphone, Zap, LogIn, MapPin, CalendarClock, ChevronDown, ChevronUp, Sparkles, Check,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  AnnouncementAdminService,
  type AnnouncementAdminRow,
  type AnnouncementAudienceGroup,
  type AnnouncementAudiencePreview,
  type AnnouncementEligibilityExplanation,
  type AnnouncementPayload,
} from '@/services/AnnouncementAdminService';
import { AnnouncementRuntime } from '@/services/AnnouncementRuntime';
import { APP_ROUTES, slugifyTitle } from './announcementRoutes';

interface UserLite { id: string; email: string | null; display_name: string | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  initial: AnnouncementAdminRow | null;
  onSaved: () => void;
}

type WhenPreset = 'now' | 'first_login' | 'specific_pages' | 'scheduled' | 'advanced';

const COLOR_SWATCHES: { id: string; from: string; to: string }[] = [
  { id: 'blue',   from: 'hsl(210,100%,65%)', to: 'hsl(280,70%,65%)' },
  { id: 'purple', from: 'hsl(280,70%,65%)',  to: 'hsl(210,100%,65%)' },
  { id: 'green',  from: 'hsl(160,80%,55%)',  to: 'hsl(210,100%,65%)' },
  { id: 'orange', from: 'hsl(25,95%,60%)',   to: 'hsl(45,100%,60%)'  },
  { id: 'pink',   from: 'hsl(320,75%,70%)',  to: 'hsl(280,70%,65%)'  },
  { id: 'amber',  from: 'hsl(45,100%,60%)',  to: 'hsl(25,95%,60%)'   },
];

const DISPLAY_TYPES = [
  { id: 'popup',  label: 'Popup',  hint: 'Full-screen modal — most attention' },
  { id: 'toast',  label: 'Toast',  hint: 'Small notification at the bottom' },
  { id: 'banner', label: 'Banner', hint: 'Thin bar at the top of the page' },
] as const;

const AUDIENCE_OPTIONS = [
  { id: 'all',             label: 'Everyone',           hint: 'All logged-in users' },
  { id: 'paid',            label: 'Paid subscribers',   hint: 'Users with active paid plan' },
  { id: 'free',            label: 'Free users',         hint: 'No subscription, no trial' },
  { id: 'trial',           label: 'Trial users',        hint: 'Currently in free trial' },
  { id: 'gifted',          label: 'Gifted accounts',    hint: 'Admin-granted access' },
  { id: 'specific_users',  label: 'Specific users',     hint: 'Pick exact people by email/name' },
  { id: 'by_country',      label: 'By country',         hint: 'Target one or more countries' },
  { id: 'by_language',     label: 'By language',        hint: 'English and/or Arabic' },
  { id: 'saved_group',     label: 'Saved group',        hint: 'Reuse a customer segment you saved earlier' },
] as const;

function toLocalInput(value: string | null): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
  } catch { return ''; }
}
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  try { return new Date(value).toISOString(); } catch { return null; }
}

function detectWhenPreset(row: AnnouncementAdminRow | null): WhenPreset {
  if (!row) return 'now';
  const routes = row.include_routes || [];
  if (row.starts_at || row.ends_at) return 'scheduled';
  if (row.trigger_type === 'on_first_login' && routes.length === 0) return 'first_login';
  if (row.trigger_type === 'on_every_app_open' && routes.length === 0) return 'now';
  if (row.trigger_type === 'on_page_visit' || routes.length > 0) return 'specific_pages';
  return 'advanced';
}

export function AnnouncementEditorModal({ open, onClose, initial, onSaved }: Props) {
  const isEdit = !!initial?.id;

  // Content
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [bodyEn, setBodyEn]   = useState('');
  const [bodyAr, setBodyAr]   = useState('');
  const [color, setColor]     = useState('blue');
  const [display, setDisplay] = useState<'popup' | 'toast' | 'banner'>('popup');
  const [announcementKey, setAnnouncementKey] = useState('');
  const [advancedKey, setAdvancedKey] = useState(false);

  // When
  const [when, setWhen] = useState<WhenPreset>('now');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt]     = useState<string | null>(null);
  const [delaySeconds, setDelaySeconds] = useState<number>(0);

  // Who
  const [audience, setAudience] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserLite[]>([]);
  const [countriesCsv, setCountriesCsv] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  const [audienceGroups, setAudienceGroups] = useState<AnnouncementAudienceGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<AnnouncementAudiencePreview | null>(null);
  const [previewingAudience, setPreviewingAudience] = useState(false);

  // How
  const [ctaEnabled, setCtaEnabled]     = useState(false);
  const [ctaLabelEn, setCtaLabelEn]     = useState('');
  const [ctaLabelAr, setCtaLabelAr]     = useState('');
  const [ctaActionType, setCtaActionType] = useState<'url' | 'navigate' | 'event' | ''>('');
  const [ctaActionValue, setCtaActionValue] = useState('');
  const [frequency, setFrequency] = useState<'show_once' | 'show_until_acted' | 'show_n_times'>('show_once');
  const [maxShows, setMaxShows]   = useState(1);
  const [priority, setPriority]   = useState<'normal' | 'high'>('normal');

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [excludeCsv, setExcludeCsv]     = useState('');
  const [deliveryUserSearch, setDeliveryUserSearch] = useState('');
  const [deliveryUserResults, setDeliveryUserResults] = useState<UserLite[]>([]);
  const [deliverySearching, setDeliverySearching] = useState(false);
  const [deliveryUser, setDeliveryUser] = useState<UserLite | null>(null);
  const [deliveryPath, setDeliveryPath] = useState('');
  const [eligibility, setEligibility] = useState<AnnouncementEligibilityExplanation | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const loadAudienceGroups = async () => {
    setGroupsLoading(true);
    try {
      const rows = await AnnouncementAdminService.listAudienceGroups();
      setAudienceGroups(rows);
    } catch (err: any) {
      toast.error('Failed to load audience groups: ' + (err?.message || 'unknown'));
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadAudienceGroups();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitleEn(initial.title_en || '');
      setTitleAr(initial.title_ar || '');
      setBodyEn(initial.body_en || '');
      setBodyAr(initial.body_ar || '');
      setColor(initial.color || 'blue');
      setDisplay(initial.display_type || 'popup');
      setAnnouncementKey(initial.announcement_key || '');
      setAdvancedKey(false);

      setWhen(detectWhenPreset(initial));
      setSelectedRoutes(initial.include_routes || []);
      setStartsAt(initial.starts_at);
      setEndsAt(initial.ends_at);
      setDelaySeconds(initial.delay_seconds || 0);

      setAudience(initial.audience_type || 'all');
      setSelectedUsers((initial.target_user_ids || []).map((id) => ({ id, email: null, display_name: null })));
      setCountriesCsv((initial.target_countries || []).join(', '));
      setLangs(initial.target_languages || []);
      setSelectedGroupId(initial.target_group_id || '');

      setCtaEnabled(!!initial.cta_enabled);
      setCtaLabelEn(initial.cta_label_en || '');
      setCtaLabelAr(initial.cta_label_ar || '');
      setCtaActionType((initial.cta_action_type as any) || '');
      setCtaActionValue(initial.cta_action_value || '');
      setFrequency(initial.frequency || 'show_once');
      setMaxShows(initial.max_shows || 1);
      setPriority(initial.priority || 'normal');

      setExcludeCsv((initial.exclude_routes || []).join(', '));
      setShowAdvanced(false);
    } else {
      setTitleEn(''); setTitleAr(''); setBodyEn(''); setBodyAr('');
      setColor('blue'); setDisplay('popup');
      setAnnouncementKey(''); setAdvancedKey(false);
      setWhen('now'); setSelectedRoutes([]); setStartsAt(null); setEndsAt(null); setDelaySeconds(0);
      setAudience('all'); setSelectedUsers([]); setCountriesCsv(''); setLangs([]);
      setSelectedGroupId('');
      setCtaEnabled(false); setCtaLabelEn(''); setCtaLabelAr(''); setCtaActionType(''); setCtaActionValue('');
      setFrequency('show_once'); setMaxShows(1); setPriority('normal');
      setExcludeCsv(''); setShowAdvanced(false);
    }
    setUserSearch(''); setUserResults([]); setGroupName(''); setGroupDescription(''); setAudiencePreview(null);
    setDeliveryUserSearch(''); setDeliveryUserResults([]); setDeliveryUser(null); setDeliveryPath(''); setEligibility(null);
  }, [open, initial]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof APP_ROUTES>();
    APP_ROUTES.forEach((r) => {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    });
    return Array.from(map.entries());
  }, []);

  const doSearch = async () => {
    const q = userSearch.trim();
    if (q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    try {
      const rows = await AnnouncementAdminService.searchUsers(q, 15);
      setUserResults(rows);
    } catch (err: any) {
      toast.error('User search failed: ' + (err?.message || 'unknown'));
    } finally { setSearching(false); }
  };

  useEffect(() => {
    if (audience !== 'specific_users') return;
    const t = setTimeout(() => { void doSearch(); }, 300);
    return () => clearTimeout(t);
  }, [userSearch, audience]);

  const addUser = (u: UserLite) => {
    if (selectedUsers.some((s) => s.id === u.id)) return;
    setSelectedUsers((prev) => [...prev, u]);
    setUserSearch('');
    setUserResults([]);
  };
  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((s) => s.id !== id));
  };
  const toggleRoute = (path: string) => {
    setSelectedRoutes((prev) => prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]);
  };
  const toggleLang = (lang: string) => {
    setLangs((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
  };

  const buildAudiencePayload = (audienceType: string = audience) => ({
    audience_type: audienceType as any,
    target_user_ids: audienceType === 'specific_users' ? selectedUsers.map((u) => u.id) : [],
    target_countries: audienceType === 'by_country'
      ? countriesCsv.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [],
    target_languages: audienceType === 'by_language' ? langs : [],
    target_group_id: audienceType === 'saved_group' ? (selectedGroupId || null) : null,
  });

  const buildPayload = (status: 'draft' | 'live'): AnnouncementPayload => {
    // When → trigger_type + include_routes + schedule
    let trigger_type: any = 'on_every_app_open';
    let include_routes: string[] = [];
    let starts_at: string | null = null;
    let ends_at: string | null = null;

    if (when === 'now')            { trigger_type = 'on_every_app_open'; }
    else if (when === 'first_login') { trigger_type = 'on_first_login';  }
    else if (when === 'specific_pages') {
      trigger_type = 'on_page_visit';
      include_routes = selectedRoutes;
    } else if (when === 'scheduled') {
      trigger_type = 'on_every_app_open';
      starts_at = startsAt;
      ends_at = endsAt;
    } else {
      // advanced: keep whatever the initial had, user uses fields directly
      trigger_type = initial?.trigger_type || 'on_every_app_open';
      include_routes = selectedRoutes;
      starts_at = startsAt;
      ends_at = endsAt;
    }

    const key = isEdit
      ? announcementKey
      : (advancedKey && announcementKey.trim())
        ? announcementKey.trim()
        : slugifyTitle(titleEn || titleAr || 'announcement');

    return {
      announcement_key: key,
      title_en: titleEn || null, title_ar: titleAr || null,
      body_en: bodyEn || null,   body_ar: bodyAr || null,
      color,
      display_type: display,
      cta_enabled: ctaEnabled,
      cta_label_en: ctaLabelEn || null,
      cta_label_ar: ctaLabelAr || null,
      cta_action_type: ctaEnabled && ctaActionType ? (ctaActionType as any) : null,
      cta_action_value: ctaEnabled ? (ctaActionValue || null) : null,
      trigger_type,
      trigger_event_key: null,
      delay_seconds: delaySeconds || 0,
      include_routes,
      exclude_routes: excludeCsv.split(',').map((s) => s.trim()).filter(Boolean),
      ...buildAudiencePayload(),
      frequency,
      max_shows: frequency === 'show_n_times' ? Math.max(1, maxShows) : 1,
      starts_at,
      ends_at,
      priority,
      status,
    };
  };

  const validate = (): string | null => {
    if (!titleEn.trim() && !titleAr.trim()) return 'Please enter a title (English or Arabic).';
    if (!bodyEn.trim() && !bodyAr.trim())   return 'Please enter a message (English or Arabic).';
    if (when === 'specific_pages' && selectedRoutes.length === 0) return 'Select at least one page.';
    if (when === 'scheduled' && !startsAt && !endsAt) return 'Pick a start or end time for the schedule.';
    if (audience === 'specific_users' && selectedUsers.length === 0) return 'Pick at least one user.';
    if (audience === 'by_country' && countriesCsv.trim().length === 0) return 'Enter at least one country code.';
    if (audience === 'by_language' && langs.length === 0) return 'Pick at least one language.';
    if (audience === 'saved_group' && !selectedGroupId) return 'Pick a saved audience group.';
    if (ctaEnabled && !ctaLabelEn.trim() && !ctaLabelAr.trim()) return 'Enter a CTA label.';
    if (ctaEnabled && !ctaActionType) return 'Pick a CTA action type.';
    if (ctaEnabled && !ctaActionValue.trim()) return 'Enter the CTA action value.';
    return null;
  };

  const refreshAudiencePreview = async () => {
    if (audience === 'saved_group' && !selectedGroupId) {
      setAudiencePreview(null);
      return;
    }
    setPreviewingAudience(true);
    try {
      const preview = await AnnouncementAdminService.previewAudience(buildPayload((initial?.status as 'draft' | 'live') || 'draft'));
      setAudiencePreview(preview);
    } catch (err: any) {
      toast.error('Audience preview failed: ' + (err?.message || 'unknown'));
    } finally {
      setPreviewingAudience(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { void refreshAudiencePreview(); }, 250);
    return () => clearTimeout(timer);
  }, [open, audience, selectedGroupId, selectedUsers, countriesCsv, langs]);

  const saveAudienceGroup = async () => {
    if (audience === 'saved_group') {
      toast.error('Switch to a direct audience first, then save it as a reusable group.');
      return;
    }
    if (!groupName.trim()) {
      toast.error('Enter a name for the saved group.');
      return;
    }
    setSavingGroup(true);
    try {
      const group = await AnnouncementAdminService.upsertAudienceGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        ...buildAudiencePayload(audience),
        audience_filter: {},
      });
      toast.success('Audience group saved');
      await loadAudienceGroups();
      setAudience('saved_group');
      setSelectedGroupId(group.id);
      setGroupName('');
      setGroupDescription('');
    } catch (err: any) {
      toast.error('Saving group failed: ' + (err?.message || 'unknown'));
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteSelectedGroup = async () => {
    const group = audienceGroups.find((item) => item.id === selectedGroupId);
    if (!group) return;
    if (!window.confirm(`Delete saved group "${group.name}"?`)) return;
    setActionBusy('delete-group');
    try {
      await AnnouncementAdminService.deleteAudienceGroup(group.id);
      toast.success('Audience group deleted');
      setSelectedGroupId('');
      setAudience('all');
      await loadAudienceGroups();
    } catch (err: any) {
      toast.error('Delete group failed: ' + (err?.message || 'unknown'));
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    const q = deliveryUserSearch.trim();
    if (!open || q.length < 2) {
      setDeliveryUserResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setDeliverySearching(true);
      try {
        const rows = await AnnouncementAdminService.searchUsers(q, 12);
        setDeliveryUserResults(rows);
      } catch (err: any) {
        toast.error('Delivery user search failed: ' + (err?.message || 'unknown'));
      } finally {
        setDeliverySearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [deliveryUserSearch, open]);

  const runEligibilityCheck = async () => {
    if (!deliveryUser?.id) {
      toast.error('Pick a user first.');
      return;
    }
    setActionBusy('eligibility');
    try {
      const result = await AnnouncementAdminService.explainUser(
        buildPayload((initial?.status as 'draft' | 'live') || 'draft'),
        deliveryUser.id,
        initial?.id ?? null,
        deliveryPath.trim() || null,
      );
      setEligibility(result);
    } catch (err: any) {
      toast.error('Eligibility check failed: ' + (err?.message || 'unknown'));
    } finally {
      setActionBusy(null);
    }
  };

  const sendTestToMe = async () => {
    if (!initial?.id) {
      toast.error('Save this announcement first, then use test send.');
      return;
    }
    setActionBusy('test-me');
    try {
      await AnnouncementAdminService.testSend(initial.id);
      AnnouncementRuntime.triggerRefresh();
      toast.success('Test send is queued for your account');
    } catch (err: any) {
      toast.error('Test send failed: ' + (err?.message || 'unknown'));
    } finally {
      setActionBusy(null);
    }
  };

  const sendTestToSelectedUser = async () => {
    if (!initial?.id || !deliveryUser?.id) {
      toast.error('Save the announcement and pick a user first.');
      return;
    }
    setActionBusy('test-user');
    try {
      await AnnouncementAdminService.testSend(initial.id, deliveryUser.id);
      AnnouncementRuntime.triggerRefresh();
      toast.success('Test send is ready for that user');
    } catch (err: any) {
      toast.error('Test send failed: ' + (err?.message || 'unknown'));
    } finally {
      setActionBusy(null);
    }
  };

  const resetSelectedUser = async () => {
    if (!initial?.id || !deliveryUser?.id) {
      toast.error('Save the announcement and pick a user first.');
      return;
    }
    setActionBusy('reset-user');
    try {
      await AnnouncementAdminService.resetForUser(initial.id, deliveryUser.id);
      AnnouncementRuntime.triggerRefresh();
      toast.success('Announcement state reset for that user');
      setEligibility(null);
    } catch (err: any) {
      toast.error('Reset failed: ' + (err?.message || 'unknown'));
    } finally {
      setActionBusy(null);
    }
  };

  const save = async (status: 'draft' | 'live') => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const payload = buildPayload(status);
      await AnnouncementAdminService.upsert(payload, initial?.id ?? null);
      AnnouncementRuntime.triggerRefresh();
      toast.success(status === 'live'
        ? (isEdit ? 'Changes published live' : 'Published live to users')
        : (isEdit ? 'Changes saved as draft' : 'Saved as draft'));
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Save failed: ' + (err?.message || 'unknown'));
    } finally { setSaving(false); }
  };

  const systemLock = !!initial?.is_system;
  const accent = COLOR_SWATCHES.find((c) => c.id === color) || COLOR_SWATCHES[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[760px] w-[96vw] max-h-[94vh] overflow-y-auto p-0 rounded-2xl border border-white/10 bg-[#0c0f14] text-white/90">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0c0f14]/95 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
            >
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{isEdit ? 'Edit Announcement' : 'New Announcement'}</h2>
              <p className="text-[11px] text-white/40 truncate">Say what, when, who, how — in that order.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-white/60 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {systemLock && (
          <div className="mx-5 mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200">
            System announcement — content is rendered by the app. You can adjust audience/schedule; the built-in UI still controls how it looks.
          </div>
        )}

        <div className="px-5 py-5 space-y-6">
          {/* ───── SECTION 1: What are you announcing? ───── */}
          <section>
            <SectionTitle n={1} title="What are you announcing?" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Title (English)">
                <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Short, catchy title" className="h-10 bg-white/5 border-white/10 text-sm" />
              </Field>
              <Field label="Title (Arabic)">
                <Input dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="عنوان قصير" className="h-10 bg-white/5 border-white/10 text-sm text-right" />
              </Field>
              <Field label="Message (English)">
                <Textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} rows={3} placeholder="What do you want users to know?" className="bg-white/5 border-white/10 text-sm" />
              </Field>
              <Field label="Message (Arabic)">
                <Textarea dir="rtl" value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} rows={3} placeholder="محتوى الإعلان" className="bg-white/5 border-white/10 text-sm text-right" />
              </Field>
            </div>

            {/* Color + Display */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Accent color">
                <div className="flex gap-2 flex-wrap">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`h-9 w-9 rounded-xl border-2 transition ${color === c.id ? 'border-white scale-105' : 'border-white/10 hover:border-white/30'}`}
                      style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                      aria-label={`Color ${c.id}`}
                    >
                      {color === c.id && <Check className="h-4 w-4 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Display style">
                <div className="grid grid-cols-3 gap-2">
                  {DISPLAY_TYPES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDisplay(d.id)}
                      className={`rounded-xl border px-2 py-2 text-left transition ${display === d.id ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    >
                      <div className="text-[12px] font-semibold text-white">{d.label}</div>
                      <div className="text-[10px] text-white/50 leading-tight">{d.hint}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {/* Advanced key (collapsed) */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setAdvancedKey((v) => !v)}
                className="text-[11px] text-white/40 hover:text-white/70 inline-flex items-center gap-1"
              >
                {advancedKey ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {isEdit ? 'Announcement key (read-only)' : 'Custom ID (auto-generated if left blank)'}
              </button>
              {advancedKey && (
                <Input
                  value={announcementKey}
                  onChange={(e) => setAnnouncementKey(e.target.value)}
                  disabled={isEdit}
                  placeholder="auto-generated from title"
                  className="mt-2 h-9 bg-white/5 border-white/10 text-xs font-mono"
                />
              )}
            </div>
          </section>

          {/* ───── SECTION 2: When should it show? ───── */}
          <section>
            <SectionTitle n={2} title="When should it show?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <WhenCard active={when === 'now'}          onClick={() => setWhen('now')}          icon={<Zap className="h-4 w-4" />}            title="Show now"          hint="Everyone sees it on next page load, anywhere in the app" />
              <WhenCard active={when === 'first_login'}  onClick={() => setWhen('first_login')}  icon={<LogIn className="h-4 w-4" />}          title="On first login"    hint="Shown only the first time they open the app" />
              <WhenCard active={when === 'specific_pages'} onClick={() => setWhen('specific_pages')} icon={<MapPin className="h-4 w-4" />}       title="On specific pages" hint="Only when they visit the pages you choose" />
              <WhenCard active={when === 'scheduled'}    onClick={() => setWhen('scheduled')}    icon={<CalendarClock className="h-4 w-4" />}  title="Scheduled window"  hint="Only within the date range you set" />
            </div>

            {when === 'specific_pages' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-white/70">Pick pages</Label>
                  <span className="text-[11px] text-white/40">{selectedRoutes.length} selected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 max-h-72 overflow-auto pr-1">
                  {grouped.map(([group, rows]) => (
                    <div key={group}>
                      <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">{group}</div>
                      <div className="space-y-1">
                        {rows.map((r) => {
                          const on = selectedRoutes.includes(r.path);
                          return (
                            <button
                              key={r.path}
                              type="button"
                              onClick={() => toggleRoute(r.path)}
                              className={`w-full flex items-center justify-between rounded-lg border px-2 py-1.5 text-left text-[12px] transition ${on ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
                            >
                              <span className="truncate">{r.label}</span>
                              <span className="flex items-center gap-2">
                                <code className="text-[10px] text-white/40 font-mono">{r.path}</code>
                                {on && <Check className="h-3 w-3 text-emerald-300" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {when === 'scheduled' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Starts at">
                  <Input type="datetime-local" value={toLocalInput(startsAt)} onChange={(e) => setStartsAt(fromLocalInput(e.target.value))} className="h-10 bg-white/5 border-white/10 text-sm" />
                </Field>
                <Field label="Ends at">
                  <Input type="datetime-local" value={toLocalInput(endsAt)} onChange={(e) => setEndsAt(fromLocalInput(e.target.value))} className="h-10 bg-white/5 border-white/10 text-sm" />
                </Field>
              </div>
            )}
          </section>

          {/* ───── SECTION 3: Who sees it? ───── */}
          <section>
            <SectionTitle n={3} title="Who sees it?" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              {AUDIENCE_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`rounded-xl border px-2 py-2 text-left transition ${audience === a.id ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="text-[12px] font-semibold text-white">{a.label}</div>
                  <div className="text-[10px] text-white/50 leading-tight">{a.hint}</div>
                </button>
              ))}
            </div>

            {audience === 'saved_group' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-white/70">Saved audience group</Label>
                  <Button type="button" variant="outline" onClick={() => void loadAudienceGroups()} disabled={groupsLoading} className="h-8 border-white/15 bg-white/5 text-white/70 hover:bg-white/10">
                    Refresh groups
                  </Button>
                </div>
                <select
                  aria-label="Saved audience group"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="h-10 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                >
                  <option value="">Pick a saved group…</option>
                  {audienceGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} · {group.usage_count} announcement{group.usage_count === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
                {selectedGroupId && (
                  <div className="rounded-xl border border-white/10 bg-[#0e1119] p-3 text-[11px] text-white/60 space-y-1">
                    <div className="text-white/85 font-medium">{audienceGroups.find((group) => group.id === selectedGroupId)?.name}</div>
                    <div>{audienceGroups.find((group) => group.id === selectedGroupId)?.description || 'No description yet.'}</div>
                    <div className="text-white/40">This group is reusable across multiple announcements.</div>
                    <div className="pt-2">
                      <Button type="button" variant="outline" onClick={() => void deleteSelectedGroup()} disabled={actionBusy === 'delete-group'} className="h-8 border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10">
                        Delete group
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {audience === 'specific_users' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email or name…"
                    className="pl-9 h-10 bg-white/5 border-white/10 text-sm"
                  />
                </div>
                {searching && <div className="text-[11px] text-white/40">Searching…</div>}
                {userResults.length > 0 && (
                  <div className="max-h-44 overflow-auto rounded-lg border border-white/10 bg-[#0e1119] divide-y divide-white/5">
                    {userResults.map((u) => {
                      const already = selectedUsers.some((s) => s.id === u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => !already && addUser(u)}
                          disabled={already}
                          className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5 disabled:opacity-50"
                        >
                          <span className="text-white/80 truncate">
                            {u.email || u.display_name || u.id}
                            {u.display_name && u.email && <span className="text-white/40 ml-2">· {u.display_name}</span>}
                          </span>
                          {already ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Plus className="h-3.5 w-3.5 text-white/50" />}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedUsers.length > 0 && (
                  <div>
                    <div className="text-[11px] text-white/50 mb-1">{selectedUsers.length} selected</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map((u) => (
                        <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200">
                          {u.email || u.display_name || u.id.slice(0, 8)}
                          <button type="button" onClick={() => removeUser(u.id)} aria-label="Remove" className="text-emerald-200/70 hover:text-emerald-100">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!searching && userSearch.trim().length >= 2 && userResults.length === 0 && (
                  <div className="text-[11px] text-white/40">No matches.</div>
                )}
              </div>
            )}

            {audience === 'by_country' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-3">
                <Field label="Country codes (ISO, comma-separated)">
                  <Input value={countriesCsv} onChange={(e) => setCountriesCsv(e.target.value)} placeholder="QA, SA, AE, US" className="h-10 bg-white/5 border-white/10 text-sm" />
                </Field>
              </div>
            )}

            {audience === 'by_language' && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/3 p-3 flex gap-3">
                {[
                  { id: 'en', label: 'English' },
                  { id: 'ar', label: 'Arabic' },
                ].map((l) => {
                  const on = langs.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLang(l.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${on ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70'}`}
                    >
                      {on && <Check className="h-3 w-3 inline mr-1" />}
                      {l.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ───── SECTION 4: How should it behave? ───── */}
          <section>
            <SectionTitle n={4} title="How should it behave?" />
            <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
              {/* CTA */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs text-white/80">Action button</Label>
                  <p className="text-[10px] text-white/40">Optional button that takes the user somewhere.</p>
                </div>
                <Switch checked={ctaEnabled} onCheckedChange={setCtaEnabled} />
              </div>
              {ctaEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Button text (EN)">
                    <Input value={ctaLabelEn} onChange={(e) => setCtaLabelEn(e.target.value)} placeholder="Try it now" className="h-10 bg-white/5 border-white/10 text-sm" />
                  </Field>
                  <Field label="Button text (AR)">
                    <Input dir="rtl" value={ctaLabelAr} onChange={(e) => setCtaLabelAr(e.target.value)} placeholder="جربها الآن" className="h-10 bg-white/5 border-white/10 text-sm text-right" />
                  </Field>
                  <Field label="On click">
                    <select
                      aria-label="Action type"
                      className="h-10 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                      value={ctaActionType}
                      onChange={(e) => setCtaActionType(e.target.value as any)}
                    >
                      <option value="">Pick an action…</option>
                      <option value="navigate">Go to a WAKTI page</option>
                      <option value="url">Open external URL</option>
                      <option value="event">Fire internal event (advanced)</option>
                    </select>
                  </Field>
                  <Field label={ctaActionType === 'navigate' ? 'Page path (e.g. /wakti-ai-v2)' : ctaActionType === 'url' ? 'External URL' : 'Event name'}>
                    <Input value={ctaActionValue} onChange={(e) => setCtaActionValue(e.target.value)} placeholder={ctaActionType === 'url' ? 'https://…' : ctaActionType === 'navigate' ? '/calendar' : 'wakti-open-memory-panel'} className="h-10 bg-white/5 border-white/10 text-sm" />
                  </Field>
                </div>
              )}

              {/* Frequency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <Field label="How often">
                  <select
                    aria-label="Frequency"
                    className="h-10 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                  >
                    <option value="show_once">Show once, then stop</option>
                    <option value="show_until_acted">Keep showing until they click the button</option>
                    <option value="show_n_times">Show N times</option>
                  </select>
                </Field>
                {frequency === 'show_n_times' && (
                  <Field label="How many times">
                    <Input type="number" min={1} value={maxShows} onChange={(e) => setMaxShows(Math.max(1, Number(e.target.value) || 1))} className="h-10 bg-white/5 border-white/10 text-sm" />
                  </Field>
                )}
                <Field label="Priority">
                  <select
                    aria-label="Priority"
                    className="h-10 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High (shown first when multiple are pending)</option>
                  </select>
                </Field>
                <Field label="Delay before showing (seconds)">
                  <Input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Math.max(0, Number(e.target.value) || 0))} className="h-10 bg-white/5 border-white/10 text-sm" />
                </Field>
              </div>
            </div>

            {/* Advanced toggle */}
            <div className="mt-3">
              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-[11px] text-white/40 hover:text-white/70 inline-flex items-center gap-1">
                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Advanced options
              </button>
              {showAdvanced && (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/3 p-3">
                  <Field label="Exclude pages (comma-separated paths)">
                    <Input value={excludeCsv} onChange={(e) => setExcludeCsv(e.target.value)} placeholder="/login, /admin*" className="h-10 bg-white/5 border-white/10 text-sm" />
                  </Field>
                  <p className="text-[10px] text-white/40 mt-2">
                    Tip: <code>/admin*</code> is always excluded automatically. You never need to add it here.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionTitle n={5} title="Delivery tools" />
            <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <Label className="text-xs text-white/80">Test and troubleshoot delivery</Label>
                  <p className="text-[10px] text-white/40 mt-1">Check exactly why a user will or will not receive this announcement.</p>
                </div>
                <Button type="button" onClick={() => void sendTestToMe()} disabled={!initial?.id || actionBusy === 'test-me'} className="h-8 bg-white/10 text-white hover:bg-white/15">
                  {actionBusy === 'test-me' ? 'Sending…' : 'Test send to me'}
                </Button>
              </div>

              {!initial?.id && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
                  Save this announcement first if you want test-send or reset tools to work.
                </div>
              )}

              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <Input value={deliveryUserSearch} onChange={(e) => setDeliveryUserSearch(e.target.value)} placeholder="Search a user to inspect delivery…" className="pl-9 h-10 bg-white/5 border-white/10 text-sm" />
              </div>
              {deliverySearching && <div className="text-[11px] text-white/40">Searching users…</div>}
              {deliveryUserResults.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-[#0e1119] divide-y divide-white/5">
                  {deliveryUserResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => { setDeliveryUser(user); setDeliveryUserSearch(''); setDeliveryUserResults([]); setEligibility(null); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <span className="text-white/80 truncate">
                        {user.email || user.display_name || user.id}
                        {user.display_name && user.email && <span className="text-white/40 ml-2">· {user.display_name}</span>}
                      </span>
                      <Plus className="h-3.5 w-3.5 text-white/50" />
                    </button>
                  ))}
                </div>
              )}

              {deliveryUser && (
                <div className="rounded-xl border border-white/10 bg-[#0e1119] p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200">
                      {deliveryUser.email || deliveryUser.display_name || deliveryUser.id}
                    </span>
                    <button type="button" onClick={() => { setDeliveryUser(null); setEligibility(null); }} className="text-[11px] text-white/40 hover:text-white/70">
                      Clear user
                    </button>
                  </div>
                  <Field label="Page path to test (optional)">
                    <Input value={deliveryPath} onChange={(e) => setDeliveryPath(e.target.value)} placeholder="/calendar or leave blank" className="h-10 bg-white/5 border-white/10 text-sm" />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void runEligibilityCheck()} disabled={actionBusy === 'eligibility'} className="h-8 border-white/15 bg-white/5 text-white/80 hover:bg-white/10">
                      {actionBusy === 'eligibility' ? 'Checking…' : 'Check eligibility'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void sendTestToSelectedUser()} disabled={!initial?.id || actionBusy === 'test-user'} className="h-8 border-white/15 bg-white/5 text-white/80 hover:bg-white/10">
                      {actionBusy === 'test-user' ? 'Sending…' : 'Test send to this user'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void resetSelectedUser()} disabled={!initial?.id || actionBusy === 'reset-user'} className="h-8 border-amber-400/20 bg-amber-400/5 text-amber-200 hover:bg-amber-400/10">
                      {actionBusy === 'reset-user' ? 'Resetting…' : 'Reset this user'}
                    </Button>
                  </div>
                </div>
              )}

              {eligibility && (
                <div className="rounded-xl border border-white/10 bg-[#0e1119] p-3 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${eligibility.eligible ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-200'}`}>
                      {eligibility.eligible ? 'Eligible' : 'Blocked'}
                    </span>
                    {eligibility.test_override && (
                      <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-200">
                        Test override active
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                    <DeliveryFlag label="Status" value={eligibility.status_ok} />
                    <DeliveryFlag label="Schedule" value={eligibility.schedule_ok} />
                    <DeliveryFlag label="Route" value={eligibility.route_ok} />
                    <DeliveryFlag label="Audience" value={eligibility.audience_ok} />
                    <DeliveryFlag label="Frequency" value={eligibility.frequency_ok} />
                  </div>
                  <div className="space-y-1">
                    {eligibility.reasons.map((reason, index) => (
                      <div key={`${reason}-${index}`} className="text-[11px] text-white/70 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 px-5 py-3 border-t border-white/10 bg-[#0c0f14]/95 backdrop-blur flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-[11px] text-white/40">
            {isEdit ? 'Editing existing announcement' : 'New draft — you can preview before going live'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="h-9 border-white/15 bg-white/5 text-white/70 hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={() => save('draft')} disabled={saving} className="h-9 bg-white/10 text-white hover:bg-white/15">
              Save as draft
            </Button>
            <Button
              onClick={() => save('live')}
              disabled={saving}
              className="h-9 px-4 bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_6px_20px_rgba(99,102,241,0.45)] hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {saving ? 'Publishing…' : 'Publish now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-[10px] font-bold text-white">{n}</span>
      <h3 className="text-sm font-semibold text-white/90">{title}</h3>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] text-white/60">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function WhenCard({ active, onClick, icon, title, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${active ? 'border-sky-400/60 bg-sky-400/10 shadow-[0_0_0_2px_hsla(210,100%,65%,0.12)]' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-sky-400/20 text-sky-200' : 'bg-white/10 text-white/70'}`}>{icon}</span>
        <span className="text-[12px] font-semibold text-white">{title}</span>
      </div>
      <div className="text-[10px] text-white/50 leading-snug">{hint}</div>
    </button>
  );
}

function DeliveryFlag({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className={`text-[12px] font-semibold ${value == null ? 'text-white/50' : value ? 'text-emerald-300' : 'text-rose-300'}`}>
        {value == null ? 'Not checked' : value ? 'Pass' : 'Fail'}
      </div>
    </div>
  );
}
