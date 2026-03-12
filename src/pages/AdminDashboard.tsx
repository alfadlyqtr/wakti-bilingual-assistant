
import { useState, useEffect } from "react";
import { Shield, RefreshCw, TrendingUp, Users, CreditCard, Brain, Apple, Smartphone, Zap, Activity, FileText, MessageSquare, Gift, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { ScrollableRecentActivity } from "@/components/admin/ScrollableRecentActivity";
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats";
import { supabase } from "@/integrations/supabase/client";

interface CeoPulse {
  total_users: number;
  active_paid_users: number;
  active_gift_users: number;
  current_mrr: number;
  conversion_rate: number;
}

interface AppMetricsDay {
  platform: string;
  downloads: number;
  revenue: number;
}

interface BrainStats {
  total_calls: number;
  total_cost: number;
  success_calls: number;
}

function KpiSkeleton() {
  return <div className="h-9 w-28 rounded-md bg-white/5 animate-pulse" />;
}

function SubSkeleton() {
  return <div className="h-4 w-16 rounded bg-white/5 animate-pulse" />;
}

export default function AdminDashboard() {
  const { recentActivity, isLoading: activityLoading, refetch } = useAdminDashboardStats();

  const [pulse, setPulse] = useState<CeoPulse | null>(null);
  const [appMetrics, setAppMetrics] = useState<AppMetricsDay[]>([]);
  const [brain, setBrain] = useState<BrainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pulseRes, metricsRes, brainRes] = await Promise.all([
        supabase.from("ceo_pulse_summary").select("*").single(),
        supabase
          .from("app_metrics")
          .select("platform, downloads, revenue")
          .eq("report_date", new Date().toISOString().slice(0, 10)),
        supabase
          .from("ai_logs")
          .select("status, cost_credits")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      if (pulseRes.data) setPulse(pulseRes.data as CeoPulse);
      if (metricsRes.data) setAppMetrics(metricsRes.data as AppMetricsDay[]);

      if (brainRes.data) {
        const rows = brainRes.data as { status: string; cost_credits: number }[];
        setBrain({
          total_calls: rows.length,
          success_calls: rows.filter((r) => r.status === "success").length,
          total_cost: rows.reduce((s, r) => s + Number(r.cost_credits ?? 0), 0),
        });
      }
    } catch (e) {
      console.error("[CommandCenter] fetch error", e);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  const handleRefresh = () => {
    refetch();
    fetchAll();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const appleToday = appMetrics.find((m) => m.platform === "apple");
  const googleToday = appMetrics.find((m) => m.platform === "google");
  const totalDownloadsToday = (appleToday?.downloads ?? 0) + (googleToday?.downloads ?? 0);

  const fmtNum = (n: number | undefined | null) =>
    n == null ? "—" : n.toLocaleString();
  const fmtQar = (n: number | undefined | null) =>
    n == null ? "—" : `${Number(n).toFixed(0)} QAR`;

  return (
    <div className="bg-[#0c0f14] text-white/90 min-h-screen">
      <AdminHeader
        title="Command Center"
        subtitle="CEO Pulse"
        icon={<Shield className="h-5 w-5 text-white/50" />}
      >
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live
          </span>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </AdminHeader>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">

        {/* ── BENTO GRID ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto">

          {/* ── CARD 1: GROWTH ── spans 1 col on sm, 1 on lg */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1119] p-5 flex flex-col gap-4 overflow-hidden
                          hover:border-blue-500/30 transition-colors duration-300
                          shadow-[0_0_40px_rgba(59,130,246,0.04)]">
            {/* Glow accent */}
            <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Growth</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-white/20" />
            </div>

            {/* KPI */}
            <div>
              <p className="text-[11px] text-white/40 mb-1">Total Users</p>
              {loading ? (
                <KpiSkeleton />
              ) : (
                <p className="text-4xl font-bold tracking-tight text-white">
                  {fmtNum(pulse?.total_users)}
                </p>
              )}
            </div>

            {/* App Store row */}
            <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Apple className="h-3 w-3 text-white/40" />
                  <span className="text-[10px] text-white/40">App Store Today</span>
                </div>
                {loading ? (
                  <SubSkeleton />
                ) : (
                  <p className="text-lg font-semibold text-white/80">
                    {appleToday ? fmtNum(appleToday.downloads) : <span className="text-white/25 text-sm">No data</span>}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Smartphone className="h-3 w-3 text-white/40" />
                  <span className="text-[10px] text-white/40">Play Store Today</span>
                </div>
                {loading ? (
                  <SubSkeleton />
                ) : (
                  <p className="text-lg font-semibold text-white/80">
                    {googleToday ? fmtNum(googleToday.downloads) : <span className="text-white/25 text-sm">No data</span>}
                  </p>
                )}
              </div>
            </div>

            {totalDownloadsToday > 0 && (
              <div className="text-[11px] text-white/30">
                {fmtNum(totalDownloadsToday)} total installs today
              </div>
            )}
          </div>

          {/* ── CARD 2: REVENUE ── */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1119] p-5 flex flex-col gap-4 overflow-hidden
                          hover:border-emerald-500/30 transition-colors duration-300
                          shadow-[0_0_40px_rgba(52,211,153,0.04)]">
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Revenue</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-white/20" />
            </div>

            {/* MRR KPI */}
            <div>
              <p className="text-[11px] text-white/40 mb-1">MRR</p>
              {loading ? (
                <KpiSkeleton />
              ) : (
                <p className="text-4xl font-bold tracking-tight text-white">
                  {fmtQar(pulse?.current_mrr)}
                </p>
              )}
            </div>

            {/* Sub grid */}
            <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="h-3 w-3 text-emerald-400/60" />
                  <span className="text-[10px] text-white/40">Active Paid</span>
                </div>
                {loading ? (
                  <SubSkeleton />
                ) : (
                  <p className="text-lg font-semibold text-white/80">{fmtNum(pulse?.active_paid_users)}</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Gift className="h-3 w-3 text-purple-400/60" />
                  <span className="text-[10px] text-white/40">Gift Subs</span>
                </div>
                {loading ? (
                  <SubSkeleton />
                ) : (
                  <p className="text-lg font-semibold text-white/80">{fmtNum(pulse?.active_gift_users)}</p>
                )}
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/3 px-3 py-2">
              <span className="text-[11px] text-white/40">Conversion Rate</span>
              {loading ? (
                <SubSkeleton />
              ) : (
                <span className="text-sm font-bold text-emerald-400">
                  {pulse?.conversion_rate != null ? `${pulse.conversion_rate}%` : "—"}
                </span>
              )}
            </div>
          </div>

          {/* ── CARD 3: THE BRAIN ── */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1119] p-5 flex flex-col gap-4 overflow-hidden
                          hover:border-violet-500/30 transition-colors duration-300
                          shadow-[0_0_40px_rgba(139,92,246,0.04)]
                          sm:col-span-2 lg:col-span-1">
            <div className="pointer-events-none absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-violet-400" />
                </div>
                <span className="text-xs font-medium text-white/50 uppercase tracking-widest">The Brain</span>
              </div>
              <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">30d</span>
            </div>

            {/* Total calls KPI */}
            <div>
              <p className="text-[11px] text-white/40 mb-1">AI Calls (30 days)</p>
              {loading ? (
                <KpiSkeleton />
              ) : (
                <p className="text-4xl font-bold tracking-tight text-white">
                  {fmtNum(brain?.total_calls)}
                </p>
              )}
            </div>

            {/* Cost + success */}
            <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3 w-3 text-amber-400/60" />
                  <span className="text-[10px] text-white/40">Total Cost</span>
                </div>
                {loading ? (
                  <SubSkeleton />
                ) : (
                  <p className="text-lg font-semibold text-white/80">
                    {brain ? `${brain.total_cost.toFixed(4)} cr` : "—"}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="h-3 w-3 text-emerald-400/60" />
                  <span className="text-[10px] text-white/40">Success</span>
                </div>
                {loading ? (
                  <SubSkeleton />
                ) : (
                  <p className="text-lg font-semibold text-white/80">
                    {brain && brain.total_calls > 0
                      ? `${((brain.success_calls / brain.total_calls) * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                )}
              </div>
            </div>

            {/* Mini bar */}
            {brain && brain.total_calls > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-white/30">
                  <span>{fmtNum(brain.success_calls)} success</span>
                  <span>{fmtNum(brain.total_calls - brain.success_calls)} errors</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                    style={{ width: `${(brain.success_calls / brain.total_calls) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── SECONDARY ROW: Quick Nav + Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Quick Nav */}
          <div className="rounded-2xl border border-white/10 bg-[#0e1119] p-5 space-y-2">
            <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-3">Quick Access</p>
            {[
              { label: "Manage Blog", icon: FileText, href: "/admin/blog", color: "text-emerald-400" },
              { label: "Messages", icon: MessageSquare, href: "/admin/messages", color: "text-sky-400" },
              { label: "Subscriptions", icon: CreditCard, href: "/admin/subscriptions", color: "text-violet-400" },
              { label: "Users", icon: Users, href: "/admin/users", color: "text-blue-400" },
            ].map(({ label, icon: Icon, href, color }) => (
              <button
                key={href}
                onClick={() => (window.location.href = href)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/5 bg-white/3 hover:bg-white/6 hover:border-white/10 transition-all duration-200 group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{label}</span>
                </div>
                <ArrowUpRight className="h-3 w-3 text-white/20 group-hover:text-white/40 transition-colors" />
              </button>
            ))}
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-[#0e1119] p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  <p className="text-xs font-medium text-white/40 uppercase tracking-widest">Live Activity</p>
                </div>
                <span className="text-[10px] text-white/25">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              </div>
              <ScrollableRecentActivity activities={recentActivity} isLoading={activityLoading} />
            </div>
          </div>

        </div>

      </div>

      <AdminMobileNav />
    </div>
  );
}
