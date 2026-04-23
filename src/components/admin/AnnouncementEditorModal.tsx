// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { AnnouncementAdminService, type AnnouncementAdminRow, type AnnouncementPayload } from '@/services/AnnouncementAdminService';

interface UserLite { id: string; email: string | null; display_name: string | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  initial: AnnouncementAdminRow | null;
  onSaved: () => void;
}

const DISPLAY_TYPES = ['popup', 'toast', 'banner'] as const;
const TRIGGERS = ['on_first_login', 'on_every_app_open', 'on_page_visit', 'on_event'] as const;
const AUDIENCES = ['all', 'paid', 'free', 'gifted', 'trial', 'specific_users', 'by_country', 'by_language', 'custom'] as const;
const FREQUENCIES = ['show_once', 'show_until_acted', 'show_n_times'] as const;
const STATUSES = ['draft', 'live', 'archived'] as const;
const COLORS = ['blue', 'purple', 'green', 'orange', 'pink', 'amber'] as const;
const CTA_ACTIONS = ['', 'url', 'navigate', 'event'] as const;

function toCsv(arr: string[] | null | undefined): string {
  return (arr || []).join(', ');
}
function fromCsv(str: string): string[] {
  return (str || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function toLocalInput(value: string | null): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60_000);
    return local.toISOString().slice(0, 16);
  } catch { return ''; }
}
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch { return null; }
}

export function AnnouncementEditorModal({ open, onClose, initial, onSaved }: Props) {
  const isEdit = !!initial?.id;

  const [form, setForm] = useState<AnnouncementPayload>({
    announcement_key: '',
    title_en: '', title_ar: '',
    body_en: '', body_ar: '',
    color: 'blue',
    cta_enabled: false,
    cta_label_en: '', cta_label_ar: '',
    cta_action_type: null,
    cta_action_value: '',
    display_type: 'popup',
    trigger_type: 'on_first_login',
    trigger_event_key: '',
    delay_seconds: 0,
    include_routes: [],
    exclude_routes: [],
    audience_type: 'all',
    target_user_ids: [],
    target_countries: [],
    target_languages: [],
    frequency: 'show_once',
    max_shows: 1,
    starts_at: null,
    ends_at: null,
    priority: 'normal',
    status: 'draft',
  });
  const [includeCsv, setIncludeCsv] = useState('');
  const [excludeCsv, setExcludeCsv] = useState('');
  const [countriesCsv, setCountriesCsv] = useState('');
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserLite[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        announcement_key: initial.announcement_key,
        title_en: initial.title_en ?? '', title_ar: initial.title_ar ?? '',
        body_en: initial.body_en ?? '', body_ar: initial.body_ar ?? '',
        color: initial.color || 'blue',
        cta_enabled: initial.cta_enabled,
        cta_label_en: initial.cta_label_en ?? '', cta_label_ar: initial.cta_label_ar ?? '',
        cta_action_type: initial.cta_action_type,
        cta_action_value: initial.cta_action_value ?? '',
        display_type: initial.display_type,
        trigger_type: initial.trigger_type,
        trigger_event_key: initial.trigger_event_key ?? '',
        delay_seconds: initial.delay_seconds,
        include_routes: initial.include_routes || [],
        exclude_routes: initial.exclude_routes || [],
        audience_type: initial.audience_type,
        target_user_ids: initial.target_user_ids || [],
        target_countries: initial.target_countries || [],
        target_languages: initial.target_languages || [],
        frequency: initial.frequency,
        max_shows: initial.max_shows,
        starts_at: initial.starts_at,
        ends_at: initial.ends_at,
        priority: initial.priority,
        status: initial.status,
      });
      setIncludeCsv(toCsv(initial.include_routes));
      setExcludeCsv(toCsv(initial.exclude_routes));
      setCountriesCsv(toCsv(initial.target_countries));
      setSelectedUsers((initial.target_user_ids || []).map((id) => ({ id, email: null, display_name: null })));
    } else {
      setForm((f) => ({ ...f, announcement_key: '', status: 'draft' }));
      setIncludeCsv(''); setExcludeCsv(''); setCountriesCsv('');
      setSelectedUsers([]);
    }
  }, [open, initial]);

  const set = (patch: Partial<AnnouncementPayload>) => setForm((f) => ({ ...f, ...patch }));

  const doSearch = async () => {
    const q = userSearch.trim();
    if (!q) { setUserResults([]); return; }
    setSearching(true);
    try {
      const rows = await AnnouncementAdminService.searchUsers(q, 15);
      setUserResults(rows);
    } catch (err: any) {
      toast.error('User search failed: ' + (err?.message || 'unknown'));
    } finally {
      setSearching(false);
    }
  };

  const addUser = (u: UserLite) => {
    if (selectedUsers.some((s) => s.id === u.id)) return;
    const next = [...selectedUsers, u];
    setSelectedUsers(next);
    set({ target_user_ids: next.map((s) => s.id) });
  };
  const removeUser = (id: string) => {
    const next = selectedUsers.filter((s) => s.id !== id);
    setSelectedUsers(next);
    set({ target_user_ids: next.map((s) => s.id) });
  };

  const handleSave = async () => {
    if (!form.announcement_key || !form.announcement_key.trim()) {
      toast.error('Announcement key is required');
      return;
    }
    setSaving(true);
    try {
      const payload: AnnouncementPayload = {
        ...form,
        include_routes: fromCsv(includeCsv),
        exclude_routes: fromCsv(excludeCsv),
        target_countries: fromCsv(countriesCsv).map((s) => s.toUpperCase()),
        target_user_ids: selectedUsers.map((u) => u.id),
      };
      await AnnouncementAdminService.upsert(payload, initial?.id ?? null);
      toast.success(isEdit ? 'Announcement updated' : 'Announcement created');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Save failed: ' + (err?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const showTriggerEvent = form.trigger_type === 'on_event';
  const showUserPicker = form.audience_type === 'specific_users';
  const showCountries = form.audience_type === 'by_country';
  const showLanguages = form.audience_type === 'by_language';
  const showMaxShows = form.frequency === 'show_n_times';
  const systemLock = !!initial?.is_system;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[720px] w-[95vw] max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-white/10 bg-[#0c0f14] text-white/90">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0c0f14]">
          <div>
            <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Announcement' : 'New Announcement'}</h2>
            <p className="text-[11px] text-white/40">Admin-authored announcement. Use a unique key.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-white/60 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {systemLock && (
          <div className="mx-5 mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200">
            System announcement — its UI is rendered by the app. Admin edits here adjust metadata/audience/schedule but the in-app component still controls how it shows.
          </div>
        )}

        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="text-xs text-white/60">Announcement key *</Label>
            <Input
              value={form.announcement_key || ''}
              onChange={(e) => set({ announcement_key: e.target.value })}
              placeholder="e.g. spring_promo_2026"
              disabled={isEdit}
              className="h-9 bg-white/5 border-white/10 text-sm"
            />
            <p className="text-[10px] text-white/30 mt-1">Stable ID used for tracking. Cannot be changed after creation.</p>
          </div>

          <div>
            <Label className="text-xs text-white/60">Title (EN)</Label>
            <Input value={form.title_en || ''} onChange={(e) => set({ title_en: e.target.value })} className="h-9 bg-white/5 border-white/10 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-white/60">Title (AR)</Label>
            <Input dir="rtl" value={form.title_ar || ''} onChange={(e) => set({ title_ar: e.target.value })} className="h-9 bg-white/5 border-white/10 text-sm text-right" />
          </div>
          <div>
            <Label className="text-xs text-white/60">Body (EN)</Label>
            <Textarea value={form.body_en || ''} onChange={(e) => set({ body_en: e.target.value })} rows={3} className="bg-white/5 border-white/10 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-white/60">Body (AR)</Label>
            <Textarea dir="rtl" value={form.body_ar || ''} onChange={(e) => set({ body_ar: e.target.value })} rows={3} className="bg-white/5 border-white/10 text-sm text-right" />
          </div>

          <div>
            <Label className="text-xs text-white/60">Color</Label>
            <select
              aria-label="Color"
              className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
              value={form.color || 'blue'}
              onChange={(e) => set({ color: e.target.value })}
            >
              {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-white/60">Display type</Label>
            <select
              aria-label="Display type"
              className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
              value={form.display_type || 'popup'}
              onChange={(e) => set({ display_type: e.target.value as any })}
            >
              {DISPLAY_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          {/* CTA section */}
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-white/70">Call-to-action</Label>
                <p className="text-[10px] text-white/40">Optional action button.</p>
              </div>
              <Switch checked={!!form.cta_enabled} onCheckedChange={(v) => set({ cta_enabled: v })} />
            </div>
            {form.cta_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-white/60">CTA label (EN)</Label>
                  <Input value={form.cta_label_en || ''} onChange={(e) => set({ cta_label_en: e.target.value })} className="h-9 bg-white/5 border-white/10 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-white/60">CTA label (AR)</Label>
                  <Input dir="rtl" value={form.cta_label_ar || ''} onChange={(e) => set({ cta_label_ar: e.target.value })} className="h-9 bg-white/5 border-white/10 text-sm text-right" />
                </div>
                <div>
                  <Label className="text-xs text-white/60">Action type</Label>
                  <select
                    aria-label="CTA action type"
                    className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                    value={form.cta_action_type || ''}
                    onChange={(e) => set({ cta_action_type: (e.target.value || null) as any })}
                  >
                    {CTA_ACTIONS.map((x) => <option key={x} value={x}>{x || '(none)'}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-white/60">Action value</Label>
                  <Input
                    value={form.cta_action_value || ''}
                    onChange={(e) => set({ cta_action_value: e.target.value })}
                    placeholder="url | /route | event-name"
                    className="h-9 bg-white/5 border-white/10 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trigger + Placement */}
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/3 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/60">Trigger</Label>
              <select
                aria-label="Trigger"
                className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                value={form.trigger_type || 'on_first_login'}
                onChange={(e) => set({ trigger_type: e.target.value as any })}
              >
                {TRIGGERS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-white/60">Delay (seconds)</Label>
              <Input type="number" min={0} value={form.delay_seconds ?? 0} onChange={(e) => set({ delay_seconds: Number(e.target.value) })} className="h-9 bg-white/5 border-white/10 text-sm" />
            </div>
            {showTriggerEvent && (
              <div className="md:col-span-2">
                <Label className="text-xs text-white/60">Internal event key</Label>
                <Input value={form.trigger_event_key || ''} onChange={(e) => set({ trigger_event_key: e.target.value })} placeholder="e.g. wakti-memory-empty" className="h-9 bg-white/5 border-white/10 text-sm" />
              </div>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs text-white/60">Include routes (comma-separated, * wildcard)</Label>
              <Input value={includeCsv} onChange={(e) => setIncludeCsv(e.target.value)} placeholder="/wakti-ai, /calendar, /projects/*" className="h-9 bg-white/5 border-white/10 text-sm" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-white/60">Exclude routes</Label>
              <Input value={excludeCsv} onChange={(e) => setExcludeCsv(e.target.value)} placeholder="/login, /admin*" className="h-9 bg-white/5 border-white/10 text-sm" />
            </div>
          </div>

          {/* Audience */}
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/3 p-3 space-y-3">
            <div>
              <Label className="text-xs text-white/60">Audience</Label>
              <select
                aria-label="Audience"
                className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                value={form.audience_type || 'all'}
                onChange={(e) => set({ audience_type: e.target.value as any })}
              >
                {AUDIENCES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            {showUserPicker && (
              <div className="space-y-2">
                <Label className="text-xs text-white/60">Specific users (search by email/name)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
                      placeholder="type at least 2 characters..."
                      className="pl-9 h-9 bg-white/5 border-white/10 text-sm"
                    />
                  </div>
                  <Button size="sm" onClick={doSearch} disabled={searching} className="h-9 bg-white/10 hover:bg-white/15 text-white">
                    {searching ? '...' : 'Search'}
                  </Button>
                </div>
                {userResults.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded-md border border-white/10 bg-[#0e1119] divide-y divide-white/5">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addUser(u)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                      >
                        <span className="text-white/80 truncate">{u.email || u.display_name || u.id}</span>
                        <Plus className="h-3.5 w-3.5 text-white/50" />
                      </button>
                    ))}
                  </div>
                )}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200">
                        {u.email || u.display_name || u.id.slice(0, 8)}
                        <button
                          type="button"
                          onClick={() => removeUser(u.id)}
                          aria-label="Remove user"
                          className="text-emerald-200/70 hover:text-emerald-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showCountries && (
              <div>
                <Label className="text-xs text-white/60">Countries (ISO codes, comma-separated)</Label>
                <Input value={countriesCsv} onChange={(e) => setCountriesCsv(e.target.value)} placeholder="QA, SA, AE" className="h-9 bg-white/5 border-white/10 text-sm" />
              </div>
            )}
            {showLanguages && (
              <div className="flex items-center gap-4">
                {['en', 'ar'].map((lang) => {
                  const active = (form.target_languages || []).includes(lang);
                  return (
                    <label key={lang} className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          const cur = form.target_languages || [];
                          set({ target_languages: e.target.checked ? [...cur, lang] : cur.filter((x) => x !== lang) });
                        }}
                      />
                      {lang.toUpperCase()}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Frequency + schedule */}
          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/3 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/60">Frequency</Label>
              <select
                aria-label="Frequency"
                className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                value={form.frequency || 'show_once'}
                onChange={(e) => set({ frequency: e.target.value as any })}
              >
                {FREQUENCIES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            {showMaxShows && (
              <div>
                <Label className="text-xs text-white/60">Max shows</Label>
                <Input type="number" min={1} value={form.max_shows ?? 1} onChange={(e) => set({ max_shows: Math.max(1, Number(e.target.value) || 1) })} className="h-9 bg-white/5 border-white/10 text-sm" />
              </div>
            )}
            <div>
              <Label className="text-xs text-white/60">Starts at</Label>
              <Input type="datetime-local" value={toLocalInput(form.starts_at as any)} onChange={(e) => set({ starts_at: fromLocalInput(e.target.value) as any })} className="h-9 bg-white/5 border-white/10 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-white/60">Ends at</Label>
              <Input type="datetime-local" value={toLocalInput(form.ends_at as any)} onChange={(e) => set({ ends_at: fromLocalInput(e.target.value) as any })} className="h-9 bg-white/5 border-white/10 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-white/60">Priority</Label>
              <select
                aria-label="Priority"
                className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                value={form.priority || 'normal'}
                onChange={(e) => set({ priority: e.target.value as any })}
              >
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-white/60">Status</Label>
              <select
                aria-label="Status"
                className="h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
                value={form.status || 'draft'}
                onChange={(e) => set({ status: e.target.value as any })}
              >
                {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 px-5 py-3 border-t border-white/10 bg-[#0c0f14] flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="h-9 border-white/15 bg-white/5 text-white/70 hover:bg-white/10">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:brightness-110">
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
