// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Megaphone, RefreshCw, Search, Filter, Download, Plus, Edit3, Archive, Copy, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AnnouncementEditorModal } from "@/components/admin/AnnouncementEditorModal";
import { AnnouncementAdminService, type AnnouncementAdminRow } from "@/services/AnnouncementAdminService";
import { AnnouncementRuntime } from "@/services/AnnouncementRuntime";
import { supabase } from "@/integrations/supabase/client";

interface AnnouncementEventRow {
  id: string;
  user_id: string;
  announcement_key: string;
  status: "seen" | "dismissed" | "acted" | "snoozed" | string;
  seen_at: string | null;
  acted_at: string | null;
  dismissed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ProfileLite {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  seen: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  acted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  dismissed: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  snoozed: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "bg-white/5 text-white/70 border-white/10";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function userLabel(userId: string, profile?: ProfileLite | null): string {
  if (!profile) return userId;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return profile.email || profile.display_name || name || userId;
}

export default function AdminAnnouncements() {
  const [tab, setTab] = useState<'announcements' | 'events'>('announcements');
  const [announcements, setAnnouncements] = useState<AnnouncementAdminRow[]>([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementAdminRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AnnouncementAdminRow | null>(null);

  const [events, setEvents] = useState<AnnouncementEventRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [keyFilter, setKeyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const rows = await AnnouncementAdminService.list();
      setAnnouncements(rows);
    } catch (err: any) {
      console.error('[AdminAnnouncements] list error:', err);
      toast.error('Failed to load announcements: ' + (err?.message || 'unknown'));
    } finally {
      setAnnLoading(false);
    }
  };

  const handleCreate = () => { setEditing(null); setEditorOpen(true); };
  const handleEdit = (row: AnnouncementAdminRow) => { setEditing(row); setEditorOpen(true); };
  const handleArchive = async (row: AnnouncementAdminRow) => {
    setBusyId(row.id);
    try {
      await AnnouncementAdminService.archive(row.id);
      AnnouncementRuntime.triggerRefresh();
      toast.success('Archived');
      fetchAnnouncements();
    } catch (err: any) {
      toast.error('Archive failed: ' + (err?.message || 'unknown'));
    } finally { setBusyId(null); }
  };
  const handleDelete = (row: AnnouncementAdminRow) => {
    if (row.is_system) { toast.error('System announcements cannot be deleted'); return; }
    setToDelete(row);
  };
  const confirmDelete = async () => {
    const row = toDelete;
    if (!row) return;
    setToDelete(null);
    setBusyId(row.id);
    try {
      await AnnouncementAdminService.remove(row.id);
      AnnouncementRuntime.triggerRefresh();
      toast.success('Deleted');
      fetchAnnouncements();
    } catch (err: any) {
      toast.error('Delete failed: ' + (err?.message || 'unknown'));
    } finally { setBusyId(null); }
  };
  const handleDuplicate = async (row: AnnouncementAdminRow) => {
    setBusyId(row.id);
    try {
      await AnnouncementAdminService.duplicate(row.id);
      toast.success('Duplicated as draft');
      fetchAnnouncements();
    } catch (err: any) {
      toast.error('Duplicate failed: ' + (err?.message || 'unknown'));
    } finally { setBusyId(null); }
  };
  const handlePublishToggle = async (row: AnnouncementAdminRow) => {
    setBusyId(row.id);
    try {
      const nextStatus = row.status === 'live' ? 'draft' : 'live';
      await AnnouncementAdminService.upsert({ status: nextStatus } as any, row.id);
      AnnouncementRuntime.triggerRefresh();
      toast.success(nextStatus === 'live' ? 'Published live' : 'Moved to draft');
      fetchAnnouncements();
    } catch (err: any) {
      toast.error('Status change failed: ' + (err?.message || 'unknown'));
    } finally { setBusyId(null); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_announcement_events")
        .select("id, user_id, announcement_key, status, seen_at, acted_at, dismissed_at, metadata, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      const rows = (data || []) as AnnouncementEventRow[];
      setEvents(rows);

      const userIds = Array.from(new Set(rows.map((r) => r.user_id))).filter(Boolean);
      if (userIds.length) {
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id, email, display_name, first_name, last_name")
          .in("id", userIds);
        if (profileErr) throw profileErr;
        const map: Record<string, ProfileLite> = {};
        (profileRows || []).forEach((p: ProfileLite) => {
          map[p.id] = p;
        });
        setProfiles(map);
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error("[AdminAnnouncements] load error:", err);
      toast.error("Failed to load announcement events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAnnouncements();
  }, []);

  const keyOptions = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.announcement_key));
    return Array.from(set).sort();
  }, [events]);

  const summaryByKey = useMemo(() => {
    const byKey = new Map<string, { total: number; seen: number; acted: number; dismissed: number; snoozed: number; uniqueUsers: Set<string> }>();
    events.forEach((e) => {
      const entry = byKey.get(e.announcement_key) || { total: 0, seen: 0, acted: 0, dismissed: 0, snoozed: 0, uniqueUsers: new Set<string>() };
      entry.total += 1;
      if (e.status === "seen") entry.seen += 1;
      else if (e.status === "acted") entry.acted += 1;
      else if (e.status === "dismissed") entry.dismissed += 1;
      else if (e.status === "snoozed") entry.snoozed += 1;
      entry.uniqueUsers.add(e.user_id);
      byKey.set(e.announcement_key, entry);
    });
    return Array.from(byKey.entries())
      .map(([key, v]) => ({ key, ...v, users: v.uniqueUsers.size }))
      .sort((a, b) => b.total - a.total);
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (keyFilter !== "all" && e.announcement_key !== keyFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      const profile = profiles[e.user_id];
      const label = userLabel(e.user_id, profile).toLowerCase();
      return (
        label.includes(q) ||
        e.user_id.toLowerCase().includes(q) ||
        e.announcement_key.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q)
      );
    });
  }, [events, keyFilter, statusFilter, search, profiles]);

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info("Nothing to export");
      return;
    }
    const header = [
      "announcement_key",
      "status",
      "user",
      "user_id",
      "seen_at",
      "acted_at",
      "dismissed_at",
      "created_at",
      "updated_at",
      "metadata",
    ];
    const lines = [header.join(",")].concat(
      filtered.map((e) => {
        const user = userLabel(e.user_id, profiles[e.user_id]);
        const row = [
          e.announcement_key,
          e.status,
          user,
          e.user_id,
          e.seen_at || "",
          e.acted_at || "",
          e.dismissed_at || "",
          e.created_at || "",
          e.updated_at || "",
          JSON.stringify(e.metadata || {}),
        ];
        return row.map((v) => JSON.stringify(v ?? "")).join(",");
      }),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "wakti_announcement_events.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="bg-[#0c0f14] text-white/90 min-h-screen">
      <AdminHeader
        title="Announcements"
        subtitle="User announcement tracking — seen / acted / dismissed"
        icon={<Megaphone className="h-5 w-5 text-accent-purple" />}
      >
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { fetchData(); fetchAnnouncements(); }}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {tab === 'events' && (
            <Button
              onClick={exportCsv}
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}
          {tab === 'announcements' && (
            <Button
              onClick={handleCreate}
              size="sm"
              className="h-8 px-3 text-xs bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">New Announcement</span>
            </Button>
          )}
        </div>
      </AdminHeader>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-6">
        {/* Tab switcher */}
        <div className="inline-flex rounded-xl border border-white/10 bg-[#0e1119] p-1">
          {[
            { id: 'announcements', label: 'Announcements' },
            { id: 'events', label: 'Events' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                tab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'announcements' && (
          <AnnouncementsList
            rows={announcements}
            loading={annLoading}
            busyId={busyId}
            onEdit={handleEdit}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onPublishToggle={handlePublishToggle}
            onCreate={handleCreate}
          />
        )}

        {tab === 'events' && (
        <>
        {/* Per-key summary */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-widest">By Announcement</h2>
            <span className="text-[11px] text-white/40">{summaryByKey.length} keys</span>
          </div>
          {loading && summaryByKey.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl border border-white/10 bg-[#0e1119] animate-pulse" />
              ))}
            </div>
          ) : summaryByKey.length === 0 ? (
            <Card className="enhanced-card">
              <CardContent className="py-8 text-center text-white/50 text-sm">
                No announcement events yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summaryByKey.map((row) => (
                <Card key={row.key} className="enhanced-card border-white/10 bg-[#0e1119]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-white/90 break-all">{row.key}</CardTitle>
                    <CardDescription className="text-[11px] text-white/40">
                      {row.total} events · {row.users} users
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-base font-bold text-sky-300">{row.seen}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Seen</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-emerald-300">{row.acted}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Acted</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-rose-300">{row.dismissed}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Dism.</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-amber-300">{row.snoozed}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Snooze</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-white/10 bg-[#0e1119] p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user, key, or status..."
                className="pl-9 h-9 bg-white/5 border-white/10 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-white/40" />
              <select
                aria-label="Filter by announcement key"
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                className="h-9 rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
              >
                <option value="all">All keys</option>
                {keyOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white/80"
              >
                <option value="all">All statuses</option>
                <option value="seen">Seen</option>
                <option value="acted">Acted</option>
                <option value="dismissed">Dismissed</option>
                <option value="snoozed">Snoozed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 bg-[#0e1119] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">Recent Events</h3>
            <span className="text-[11px] text-white/40">{filtered.length} / {events.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-white/40 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">User</th>
                  <th className="text-left px-4 py-2 font-medium">Key</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Seen</th>
                  <th className="text-left px-4 py-2 font-medium">Acted</th>
                  <th className="text-left px-4 py-2 font-medium">Dismissed</th>
                  <th className="text-left px-4 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-white/40 text-sm">
                      Loading announcement events…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-white/40 text-sm">
                      No matching events.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => {
                    const profile = profiles[e.user_id];
                    return (
                      <tr key={e.id} className="border-t border-white/5 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-2 align-top">
                          <div className="text-white/90 text-[13px] truncate max-w-[240px]" title={userLabel(e.user_id, profile)}>
                            {userLabel(e.user_id, profile)}
                          </div>
                          <div className="text-[10px] text-white/30 font-mono">{e.user_id.slice(0, 8)}…</div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <span className="text-white/80 text-[13px] break-all">{e.announcement_key}</span>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <StatusPill status={e.status} />
                        </td>
                        <td className="px-4 py-2 align-top text-white/60 text-[12px] whitespace-nowrap">{formatDate(e.seen_at)}</td>
                        <td className="px-4 py-2 align-top text-white/60 text-[12px] whitespace-nowrap">{formatDate(e.acted_at)}</td>
                        <td className="px-4 py-2 align-top text-white/60 text-[12px] whitespace-nowrap">{formatDate(e.dismissed_at)}</td>
                        <td className="px-4 py-2 align-top text-white/60 text-[12px] whitespace-nowrap">{formatDate(e.updated_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}
      </div>

      <AnnouncementEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={editing}
        onSaved={fetchAnnouncements}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => { if (!v) setToDelete(null); }}>
        <AlertDialogContent className="bg-[#0c0f14] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete announcement?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will permanently delete
              <span className="mx-1 text-white font-semibold break-all">"{toDelete?.title_en || toDelete?.announcement_key}"</span>
              and cannot be undone. Existing event history remains in the Events tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:brightness-110"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminMobileNav />
    </div>
  );
}

function AnnouncementsList({
  rows,
  loading,
  busyId,
  onEdit,
  onArchive,
  onDelete,
  onDuplicate,
  onPublishToggle,
  onCreate,
}: {
  rows: AnnouncementAdminRow[];
  loading: boolean;
  busyId: string | null;
  onEdit: (row: AnnouncementAdminRow) => void;
  onArchive: (row: AnnouncementAdminRow) => void;
  onDelete: (row: AnnouncementAdminRow) => void;
  onDuplicate: (row: AnnouncementAdminRow) => void;
  onPublishToggle: (row: AnnouncementAdminRow) => void;
  onCreate: () => void;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-2xl border border-white/10 bg-[#0e1119] animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0e1119] p-10 text-center">
        <Megaphone className="h-10 w-10 mx-auto text-white/30 mb-3" />
        <h3 className="text-base font-semibold text-white/80">No announcements yet</h3>
        <p className="text-sm text-white/50 mt-1">Create your first announcement to ship it to users.</p>
        <Button onClick={onCreate} className="mt-4 bg-gradient-to-r from-sky-500 to-violet-500 text-white hover:brightness-110">
          <Plus className="h-4 w-4 mr-1.5" />
          New Announcement
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((row) => {
        const isBusy = busyId === row.id;
        const conv = row.total_events > 0 ? Math.round((row.acted_count / row.total_events) * 100) : 0;
        return (
          <Card key={row.id} className="enhanced-card border-white/10 bg-[#0e1119]">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold text-white/90 break-all">
                      {row.title_en || row.announcement_key}
                    </CardTitle>
                    {row.is_system && (
                      <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                        System
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-[11px] text-white/40 break-all mt-0.5">
                    {row.announcement_key}
                  </CardDescription>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    row.status === 'live'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : row.status === 'draft'
                      ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                      : 'bg-white/5 text-white/60 border-white/10'
                  }`}
                >
                  {row.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {row.body_en && (
                <p className="text-[12px] text-white/60 line-clamp-2 whitespace-pre-line">{row.body_en}</p>
              )}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-white/70">{row.display_type}</span>
                <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-white/70">{row.trigger_type}</span>
                <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-white/70">{row.audience_type}</span>
                <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-white/70">{row.frequency}</span>
                {row.priority === 'high' && (
                  <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-rose-200">high priority</span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <Stat label="Sent" value={row.unique_users} color="text-white/80" />
                <Stat label="Seen" value={row.seen_count} color="text-sky-300" />
                <Stat label="Acted" value={row.acted_count} color="text-emerald-300" />
                <Stat label="Dism." value={row.dismissed_count} color="text-rose-300" />
                <Stat label="Conv." value={`${conv}%`} color="text-amber-300" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => onEdit(row)} disabled={isBusy} className="h-8 px-2 text-[11px] border-white/15 bg-white/5 text-white/80 hover:bg-white/10">
                  <Edit3 className="h-3 w-3 mr-1" />Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => onPublishToggle(row)}
                  disabled={isBusy || row.status === 'archived'}
                  className={`h-8 px-2 text-[11px] text-white ${row.status === 'live' ? 'bg-white/10 hover:bg-white/15' : 'bg-gradient-to-r from-sky-500 to-violet-500 hover:brightness-110'}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {row.status === 'live' ? 'Unpublish' : 'Publish'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDuplicate(row)} disabled={isBusy} className="h-8 px-2 text-[11px] border-white/15 bg-white/5 text-white/70 hover:bg-white/10">
                  <Copy className="h-3 w-3 mr-1" />Duplicate
                </Button>
                <Button size="sm" variant="outline" onClick={() => onArchive(row)} disabled={isBusy || row.status === 'archived'} className="h-8 px-2 text-[11px] border-white/15 bg-white/5 text-white/60 hover:bg-white/10">
                  <Archive className="h-3 w-3 mr-1" />Archive
                </Button>
                {!row.is_system && (
                  <Button size="sm" variant="outline" onClick={() => onDelete(row)} disabled={isBusy} className="h-8 px-2 text-[11px] border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10">
                    <Trash2 className="h-3 w-3 mr-1" />Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-white/40 uppercase tracking-wider">{label}</div>
    </div>
  );
}
