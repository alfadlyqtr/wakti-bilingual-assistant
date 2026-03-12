// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Shield, Users, Search, CheckCircle, XCircle, AlertTriangle, RefreshCw, UserCog, CreditCard, Gift, Clock, Plus, TrendingUp, Eye, Flame, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { getAdminSession } from "@/utils/adminAuth";

interface User {
  id: string;
  email: string;
  display_name: string;
  is_subscribed: boolean;
  subscription_status: string;
  plan_name: string;
  billing_start_date: string;
  next_billing_date: string;
  payment_method: string;
  created_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  plan_name: string;
  billing_amount: number;
  billing_currency: string;
  billing_cycle: string;
  start_date: string;
  next_billing_date: string;
  payment_method: string;
  fawran_payment_id: string;
  is_gift: boolean;
  gift_duration: string;
  gift_given_by: string;
  created_at: string;
}

export default function AdminSubscriptions() {
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [activationData, setActivationData] = useState({
    planName: "Monthly Plan",
    billingAmount: 60,
    paymentMethod: "manual",
    isGift: false,
    giftDuration: "1_week"
  });
  // Trial management local state (per-user minutes input)
  const [trialMinutesInput, setTrialMinutesInput] = useState<Record<string, string>>({});

  const getTrialStatus = (user: any) => {
    if (user?.is_subscribed) return { label: "Subscribed", remaining: 0, expired: false, notStarted: false };
    const startAt = user?.free_access_start_at as string | null;
    if (!startAt) return { label: "Trial not started", remaining: 30, expired: false, notStarted: true };
    const start = Date.parse(startAt);
    const elapsedMin = Math.floor((Date.now() - start) / 60000);
    const remaining = Math.max(0, 30 - elapsedMin);
    const expired = elapsedMin >= 30;
    return { label: expired ? `Trial expired (${elapsedMin} min used)` : `${remaining} min remaining`, remaining, expired, notStarted: false };
  };

  const handleAdjustTrial = async (user: any, action: 'reset' | 'extend') => {
    try {
      const minutesStr = trialMinutesInput[user.id] ?? '30';
      const minutes = Math.max(1, parseInt(minutesStr || '30'));
      const { error } = await (supabase as any).rpc('admin_adjust_trial', {
        p_user_id: user.id,
        p_action: action,
        p_minutes: minutes,
      });
      if (error) throw error;
      toast.success(action === 'reset' ? `Reset 4-day trial for ${user.email}` : `Extended trial by ${minutes} minutes for ${user.email}`);
      await loadData();
    } catch (err: any) {
      console.error('Adjust trial failed:', err);
      toast.error(`Failed to adjust trial: ${err?.message || 'Unknown error'}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load users with subscription info
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .neq('display_name', '[DELETED USER]')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Load subscription details
      const { data: subscriptionsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (subsError) throw subsError;

      setUsers(usersData || []);
      setSubscriptions(subscriptionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentAdminId = async (): Promise<string | null> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user?.id) return null;
      const adminSession = getAdminSession();
      if (adminSession?.admin_id) return adminSession.admin_id;
      const { data: adminData, error: adminError } = await supabase
        .rpc('get_admin_by_auth_id', { auth_user_id: session.user.id });
      if (adminError || !adminData || adminData.length === 0) return null;
      return adminData[0].id;
    } catch {
      return null;
    }
  };

  const handleActivateSubscription = async () => {
    if (!selectedUser) { toast.error('No user selected'); return; }
    setIsActivating(true);
    try {
      const adminId = await getCurrentAdminId();
      if (!adminId) { toast.error('Admin session invalid - please login again'); setIsActivating(false); return; }
      const { data, error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: selectedUser.id,
        p_plan_name: activationData.isGift ? `Gift ${activationData.giftDuration.replace('_', ' ')}` : activationData.planName,
        p_billing_amount: activationData.isGift ? 0 : activationData.billingAmount,
        p_billing_currency: 'QAR',
        p_payment_method: activationData.isGift ? 'gift' : activationData.paymentMethod,
        p_is_gift: activationData.isGift,
        p_gift_duration: activationData.isGift ? activationData.giftDuration : null,
        p_gift_given_by: activationData.isGift ? adminId : null
      });
      if (error) {
        toast.error(`Failed to activate: ${error.message}`);
        setDebugInfo({ error: error.message, code: error.code });
      } else {
        const durationDays = activationData.isGift ?
          (activationData.giftDuration === '1_week' ? '7 days' : activationData.giftDuration === '2_weeks' ? '14 days' : '30 days') : '';
        toast.success(`${activationData.isGift ? 'Gift subscription' : 'Subscription'} activated for ${selectedUser.email} ${durationDays ? `(${durationDays})` : ''}`);
        if (data?.expiry_date) toast.info(`Expires: ${new Date(data.expiry_date).toLocaleDateString()}`);
        setShowActivationModal(false);
        setSelectedUser(null);
        setActivationData({ planName: 'Monthly Plan', billingAmount: 60, paymentMethod: 'manual', isGift: false, giftDuration: '1_week' });
        await loadData();
      }
    } catch (err) {
      toast.error(`Activation failed: ${String(err)}`);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivateSubscription = async (user: User) => {
    try {
      const { error: profileError } = await supabase.from('profiles').update({ is_subscribed: false, subscription_status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', user.id);
      if (profileError) throw profileError;
      const { error: subsError } = await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('status', 'active');
      if (subsError) throw subsError;
      toast.success(`Subscription deactivated for ${user.email}`);
      loadData();
    } catch (error) {
      toast.error(`Failed to deactivate: ${error.message}`);
    }
  };

  const handleProcessExpiredSubscriptions = async () => {
    try {
      toast.info('Processing expired subscriptions...');
      const { data, error } = await supabase.functions.invoke('process-expired-subscriptions');
      if (error) { toast.error(`Failed: ${error.message}`); return; }
      const expiredCount = data?.result?.expired_count || 0;
      expiredCount > 0 ? toast.success(`Processed ${expiredCount} expired subscription(s)`) : toast.info('No expired subscriptions found');
      loadData();
    } catch (error) {
      toast.error(`Failed: ${String(error)}`);
    }
  };

  const getPaymentMethodIcon = (method: string, isGift: boolean = false) => {
    if (isGift) {
      return <Gift className="h-4 w-4 text-accent-purple" />;
    }
    switch (method) {
      case 'manual':
        return <UserCog className="h-4 w-4 text-accent-orange" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPaymentMethodLabel = (method: string, isGift: boolean = false) => {
    if (isGift) {
      return 'Gift Subscription';
    }
    switch (method) {
      case 'manual':
        return 'Manual Admin';
      default:
        return 'Manual/Legacy';
    }
  };

  const getPaymentMethodColor = (method: string, isGift: boolean = false) => {
    if (isGift) {
      return 'text-accent-purple';
    }
    switch (method) {
      case 'manual':
        return 'text-accent-orange';
      default:
        return 'text-muted-foreground';
    }
  };

  const getUserSubscription = (userId: string): Subscription | null => {
    return subscriptions.find(sub => sub.user_id === userId && sub.status === 'active') || null;
  };

  const isGiftSubscription = (user: User): boolean => {
    const subscription = getUserSubscription(user.id);
    return subscription?.is_gift || false;
  };

  const getGiftDuration = (user: User): string => {
    const subscription = getUserSubscription(user.id);
    return subscription?.gift_duration?.replace('_', ' ') || '';
  };

  const getRemainingGiftTime = (user: User): string => {
    if (!isGiftSubscription(user) || !user.next_billing_date) return '';
    
    const expiryDate = new Date(user.next_billing_date);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "all" || 
      (filterStatus === "subscribed" && user.is_subscribed) ||
      (filterStatus === "unsubscribed" && !user.is_subscribed) ||
      (filterStatus === "gifts" && isGiftSubscription(user));
    
    return matchesSearch && matchesFilter;
  });

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of filteredUsers) map.set(u.id, u);
    return map;
  }, [filteredUsers]);

  const openActivationForUser = (user: User) => {
    setSelectedUser(user);
    setShowActivationModal(true);
  };

  const giftSubscriptionsCount = users.filter(user => isGiftSubscription(user)).length;

  // ── Growth Lab derived data ──
  const whaleWatch = useMemo(() => {
    return users
      .filter(u => u.is_subscribed)
      .map(u => {
        const sub = getUserSubscription(u.id);
        const mrr = sub ? (sub.billing_cycle === 'yearly' ? sub.billing_amount / 12 : sub.billing_amount) : 60;
        return { ...u, mrr, isGift: sub?.is_gift || false };
      })
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 5);
  }, [users, subscriptions]);

  const churnRisk = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return users
      .filter(u => {
        if (!u.is_subscribed) return false;
        const lastSeen = u.updated_at ? new Date(u.updated_at) : new Date(u.created_at);
        return lastSeen < sevenDaysAgo;
      })
      .slice(0, 5);
  }, [users]);

  const conversionFunnel = useMemo(() => {
    const total = users.length;
    const paid = users.filter(u => u.is_subscribed && !isGiftSubscription(u)).length;
    const gifts = giftSubscriptionsCount;
    const trials = users.filter(u => !u.is_subscribed && u.free_access_start_at).length;
    const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
    const trialPct = total > 0 ? Math.round((trials / total) * 100) : 0;
    return { total, paid, gifts, trials, paidPct, trialPct };
  }, [users, subscriptions]);

  if (isLoading) {
    return (
      <div className="bg-[#0c0f14] min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Growth Lab…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0c0f14] min-h-screen text-white/90">
      <AdminHeader
        title="Growth Lab"
        subtitle="Strategic Subscriptions"
        icon={<TrendingUp className="h-5 w-5 text-emerald-400/60" />}
      >
        <div className="flex gap-2">
          <Button onClick={handleProcessExpiredSubscriptions} variant="outline" size="sm"
            className="h-8 text-xs bg-white/5 border-white/15 text-white/60 hover:bg-white/10 hover:text-white">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Expire</span>
          </Button>
          <Button onClick={loadData} variant="outline" size="sm"
            className="h-8 text-xs bg-white/5 border-white/15 text-white/60 hover:bg-white/10 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </AdminHeader>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 pb-28 space-y-5">

        {/* ── BENTO GROWTH LAB ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* CARD 1: WHALE WATCH */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1119] p-5 flex flex-col gap-3 overflow-hidden
                          hover:border-emerald-500/30 transition-colors duration-300
                          shadow-[0_0_40px_rgba(52,211,153,0.04)]">
            <div className="pointer-events-none absolute -top-8 -left-8 w-36 h-36 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Whale Watch</span>
              </div>
              <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">Top MRR</span>
            </div>
            <div className="space-y-2 mt-1">
              {whaleWatch.length === 0 && (
                <p className="text-white/25 text-sm py-4 text-center">No active subscribers</p>
              )}
              {whaleWatch.map((user, i) => (
                <div key={user.id} className="flex items-center gap-3 group">
                  <span className="text-[11px] text-white/25 w-4 flex-shrink-0">#{i + 1}</span>
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white/60">
                    {(user.display_name || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate">{user.display_name || 'No name'}</p>
                    <p className="text-[10px] text-white/35 truncate">{user.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400">{user.mrr} QAR</p>
                    {user.isGift && <span className="text-[9px] text-violet-400">Gift</span>}
                  </div>
                  <button
                    onClick={() => openActivationForUser(user)}
                    aria-label="Manage subscription"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/60"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CARD 2: CHURN RISK */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1119] p-5 flex flex-col gap-3 overflow-hidden
                          hover:border-amber-500/30 transition-colors duration-300
                          shadow-[0_0_40px_rgba(245,158,11,0.04)]">
            <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-amber-500/8 blur-3xl" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Churn Risk</span>
              </div>
              <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">Inactive 7d+</span>
            </div>
            {churnRisk.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <CheckCircle className="h-8 w-8 text-emerald-400/40" />
                <p className="text-white/30 text-xs text-center">All subscribers were active recently</p>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {churnRisk.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 group">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-amber-300">
                      {(user.display_name || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">{user.display_name || 'No name'}</p>
                      <p className="text-[10px] text-white/35 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => handleDeactivateSubscription(user)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] border border-red-500/30 text-red-400 rounded-lg px-2 py-1 hover:bg-red-500/10"
                    >
                      Deactivate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CARD 3: CONVERSION FUNNEL */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1119] p-5 flex flex-col gap-4 overflow-hidden
                          hover:border-sky-500/30 transition-colors duration-300
                          shadow-[0_0_40px_rgba(14,165,233,0.04)]">
            <div className="pointer-events-none absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-sky-500/8 blur-3xl" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-sky-400" />
              </div>
              <span className="text-xs font-medium text-white/50 uppercase tracking-widest">Conversion Funnel</span>
            </div>
            {/* Total KPI */}
            <div>
              <p className="text-[11px] text-white/40 mb-0.5">Total Users</p>
              <p className="text-4xl font-bold tracking-tight text-white">{conversionFunnel.total.toLocaleString()}</p>
            </div>
            {/* Funnel bars */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-white/50">Paid ({conversionFunnel.paid})</span>
                  <span className="text-emerald-400 font-medium">{conversionFunnel.paidPct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${conversionFunnel.paidPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-white/50">Gift ({conversionFunnel.gifts})</span>
                  <span className="text-violet-400 font-medium">{conversionFunnel.total > 0 ? Math.round((conversionFunnel.gifts / conversionFunnel.total) * 100) : 0}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-700"
                    style={{ width: `${conversionFunnel.total > 0 ? (conversionFunnel.gifts / conversionFunnel.total) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-white/50">Trials Active ({conversionFunnel.trials})</span>
                  <span className="text-sky-400 font-medium">{conversionFunnel.trialPct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400 transition-all duration-700"
                    style={{ width: `${conversionFunnel.trialPct}%` }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── USERS TABLE (clean, no Grid.js) ── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <Input
                placeholder="Search by email or name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl border-white/10 bg-[#0e1119] text-white placeholder-white/25 focus:border-emerald-500/40 text-sm"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44 h-10 rounded-xl border-white/10 bg-[#0e1119] text-white/70 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="gifts">Gift Subscriptions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-white/25 text-sm">No users matched.</div>
            ) : (
              filteredUsers.map((user) => {
                const isGift = isGiftSubscription(user);
                const trial = getTrialStatus(user);
                return (
                  <div key={user.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#0e1119] px-4 py-3 hover:border-emerald-500/20 transition-all duration-200 group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white/50">
                      {(user.display_name || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{user.display_name || 'No name'}</p>
                      <p className="text-xs text-white/35 truncate">{user.email}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      {user.is_subscribed ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                          {isGift ? `Gift · ${getRemainingGiftTime(user)}` : (user.plan_name || 'Active')}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/30">
                          {trial.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {user.is_subscribed ? (
                        <button
                          onClick={() => handleDeactivateSubscription(user)}
                          className="text-[10px] border border-red-500/30 text-red-400 rounded-lg px-2 py-1 hover:bg-red-500/10 transition-colors"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => openActivationForUser(user)}
                          className="text-[10px] border border-emerald-500/30 text-emerald-400 rounded-lg px-2 py-1 hover:bg-emerald-500/10 transition-colors"
                        >
                          Activate
                        </button>
                      )}
                      {!user.is_subscribed && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={trialMinutesInput[user.id] ?? ''}
                            placeholder="min"
                            aria-label="Extend trial minutes"
                            onChange={(e) => setTrialMinutesInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                            className="h-7 w-16 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white"
                          />
                          <button
                            onClick={() => handleAdjustTrial(user, 'reset')}
                            className="text-[10px] border border-white/10 text-white/50 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => handleAdjustTrial(user, 'extend')}
                            className="text-[10px] border border-white/10 text-white/50 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors"
                          >
                            Extend
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Enhanced Activation Modal with Debug Info */}
      <Dialog open={showActivationModal} onOpenChange={setShowActivationModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activationData.isGift ? (
                <>
                  <Gift className="h-5 w-5 text-accent-purple" />
                  Gift Subscription
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-accent-green" />
                  Activate Subscription
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {activationData.isGift ? 'Give a gift subscription to' : 'Activate subscription for'} {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          {/* Debug Info in Modal */}
          {selectedUser && (
            <details className="text-xs bg-muted/30 p-2 rounded mb-3 text-muted-foreground">
              <summary className="cursor-pointer select-none">Debug Info</summary>
              <div className="mt-2 space-y-1">
                <div>User ID: {selectedUser.id}</div>
                <div>Email: {selectedUser.email}</div>
                <div>Currently Subscribed: {selectedUser.is_subscribed ? 'Yes' : 'No'}</div>
                <div>Status: {selectedUser.subscription_status || 'N/A'}</div>
              </div>
            </details>
          )}
          
          <div className="space-y-4">
            {/* Gift Toggle */}
            <div className="flex items-center space-x-2 p-3 bg-accent-purple/10 rounded-lg border border-accent-purple/20">
              <Switch
                id="gift-mode"
                checked={activationData.isGift}
                onCheckedChange={(checked) => setActivationData(prev => ({
                  ...prev, 
                  isGift: checked,
                  billingAmount: checked ? 0 : 60
                }))}
              />
              <Label htmlFor="gift-mode" className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-accent-purple" />
                Gift Subscription
              </Label>
            </div>

            {activationData.isGift ? (
              /* Gift Options with precise duration labels */
              <div>
                <Label>Gift Duration</Label>
                <Select 
                  value={activationData.giftDuration} 
                  onValueChange={(value) => setActivationData(prev => ({...prev, giftDuration: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[2000]">
                    <SelectItem value="1_week">1 Week Gift (7 days)</SelectItem>
                    <SelectItem value="2_weeks">2 Weeks Gift (14 days)</SelectItem>
                    <SelectItem value="1_month">1 Month Gift (30 days)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  {activationData.giftDuration === '1_week' && 'Expires exactly 7 days from activation'}
                  {activationData.giftDuration === '2_weeks' && 'Expires exactly 14 days from activation'}
                  {activationData.giftDuration === '1_month' && 'Expires exactly 30 days from activation'}
                </div>
              </div>
            ) : (
              /* Regular Subscription Options */
              <>
                <div>
                  <Label>Plan Type</Label>
                  <Select 
                    value={activationData.planName} 
                    onValueChange={(value) => setActivationData(prev => ({
                      ...prev, 
                      planName: value,
                      billingAmount: value.includes('Yearly') ? 600 : 60
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[2000]">
                      <SelectItem value="Monthly Plan">Monthly Plan (60 QAR)</SelectItem>
                      <SelectItem value="Yearly Plan">Yearly Plan (600 QAR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Payment Method</Label>
                  <Select 
                    value={activationData.paymentMethod} 
                    onValueChange={(value) => setActivationData(prev => ({...prev, paymentMethod: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[3000]">
                      <SelectItem value="manual">Manual Admin Activation</SelectItem>
                      <SelectItem value="fawran">Fawran (when linked to payment)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Billing Amount</Label>
                  <Input
                    type="number"
                    value={activationData.billingAmount}
                    onChange={(e) => setActivationData(prev => ({...prev, billingAmount: Number(e.target.value)}))}
                    disabled={activationData.isGift}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('[DEBUG] Closing activation modal');
                setShowActivationModal(false);
                setSelectedUser(null);
                setActivationData({
                  planName: "Monthly Plan",
                  billingAmount: 60,
                  paymentMethod: "manual",
                  isGift: false,
                  giftDuration: "1_week"
                });
              }}
              disabled={isActivating}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                console.log('[DEBUG] Activation button clicked');
                handleActivateSubscription();
              }}
              disabled={isActivating}
              className={`${activationData.isGift ? 'bg-accent-purple hover:bg-accent-purple/90' : 'btn-enhanced hover:shadow-glow'}`}
            >
              {isActivating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : activationData.isGift ? (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Give Gift
                </>
              ) : (
                'Activate Subscription'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
