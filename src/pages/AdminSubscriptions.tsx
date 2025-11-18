// @ts-nocheck
import { useEffect, useState } from "react";
import { Shield, Users, Search, Filter, CheckCircle, XCircle, AlertTriangle, RefreshCw, Smartphone, UserCog, UserX, CreditCard, Calendar, Gift, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      toast.success(action === 'reset' ? `Reset 30-min trial for ${user.email}` : `Extended trial by ${minutes} minutes for ${user.email}`);
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
      // Get current Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user?.id) {
        console.error('[DEBUG] No Supabase session found:', error);
        return null;
      }

      // Check localStorage for admin session
      const adminSession = getAdminSession();
      if (adminSession?.admin_id) {
        console.log('[DEBUG] Admin ID from localStorage:', adminSession.admin_id);
        return adminSession.admin_id;
      }

      // Fallback: get admin info from database
      const { data: adminData, error: adminError } = await supabase
        .rpc('get_admin_by_auth_id', {
          auth_user_id: session.user.id
        });

      if (adminError || !adminData || adminData.length === 0) {
        console.error('[DEBUG] Failed to get admin info:', adminError);
        return null;
      }

      console.log('[DEBUG] Admin ID from database:', adminData[0].id);
      return adminData[0].id;
    } catch (error) {
      console.error('[DEBUG] Error getting admin ID:', error);
      return null;
    }
  };

  const handleActivateSubscription = async () => {
    if (!selectedUser) {
      console.error('[DEBUG] No user selected for activation');
      toast.error('No user selected');
      return;
    }

    console.log('[DEBUG] Starting activation process for user:', {
      userId: selectedUser.id,
      email: selectedUser.email,
      currentStatus: selectedUser.is_subscribed,
      activationData
    });

    setIsActivating(true);
    
    try {
      const adminId = await getCurrentAdminId();
      
      if (!adminId) {
        console.error('[DEBUG] No admin ID available');
        toast.error('Admin session invalid - please login again');
        setIsActivating(false);
        return;
      }

      console.log('[DEBUG] Calling admin_activate_subscription with params:', {
        p_user_id: selectedUser.id,
        p_plan_name: activationData.isGift ? `Gift ${activationData.giftDuration.replace('_', ' ')}` : activationData.planName,
        p_billing_amount: activationData.isGift ? 0 : activationData.billingAmount,
        p_billing_currency: 'QAR',
        p_payment_method: activationData.isGift ? 'gift' : activationData.paymentMethod,
        p_is_gift: activationData.isGift,
        p_gift_duration: activationData.isGift ? activationData.giftDuration : null,
        p_gift_given_by: activationData.isGift ? adminId : null
      });

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

      console.log('[DEBUG] RPC Response:', { data, error });

      if (error) {
        console.error('[DEBUG] Activation error:', error);
        toast.error(`Failed to activate subscription: ${error.message}`);
        setDebugInfo({ error: error.message, code: error.code, details: error.details });
      } else {
        console.log('[DEBUG] Activation successful:', data);
        const actionType = activationData.isGift ? 'Gift subscription' : 'Subscription';
        const duration = activationData.isGift ? activationData.giftDuration.replace('_', ' ') : '';
        const durationDays = activationData.isGift ? 
          (activationData.giftDuration === '1_week' ? '7 days' :
           activationData.giftDuration === '2_weeks' ? '14 days' :
           activationData.giftDuration === '1_month' ? '30 days' : '') : '';
        
        toast.success(`${actionType} activated for ${selectedUser.email} ${durationDays ? `(${durationDays})` : ''}`);
        
        if (data?.expiry_date) {
          const expiryDate = new Date(data.expiry_date).toLocaleDateString();
          toast.info(`Subscription expires on: ${expiryDate}`);
        }
        
        setShowActivationModal(false);
        setSelectedUser(null);
        setActivationData({
          planName: "Monthly Plan",
          billingAmount: 60,
          paymentMethod: "manual",
          isGift: false,
          giftDuration: "1_week"
        });
        
        // Reload data to see changes
        await loadData();
      }
    } catch (error) {
      console.error('[DEBUG] Exception during activation:', error);
      toast.error(`Activation failed: ${String(error)}`);
      setDebugInfo({ exception: String(error) });
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivateSubscription = async (user: User) => {
    try {
      console.log('[DEBUG] Starting deactivation for user:', {
        userId: user.id,
        email: user.email,
        currentStatus: user.is_subscribed
      });

      // Update user profile first
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_subscribed: false,
          subscription_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('[DEBUG] Profile update error:', profileError);
        throw profileError;
      }

      // Update subscription record
      const { error: subsError } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (subsError) {
        console.error('[DEBUG] Subscription update error:', subsError);
        throw subsError;
      }

      console.log('[DEBUG] Deactivation successful for:', user.email);
      toast.success(`Subscription deactivated for ${user.email}`);
      loadData();
    } catch (error) {
      console.error('[DEBUG] Error deactivating subscription:', error);
      toast.error(`Failed to deactivate subscription: ${error.message}`);
    }
  };

  const handleProcessExpiredSubscriptions = async () => {
    try {
      console.log('[DEBUG] Manually processing expired subscriptions...');
      toast.info('Processing expired subscriptions...');
      
      const { data, error } = await supabase.functions.invoke('process-expired-subscriptions');
      
      if (error) {
        console.error('[DEBUG] Error processing expired subscriptions:', error);
        toast.error(`Failed to process expired subscriptions: ${error.message}`);
        return;
      }
      
      console.log('[DEBUG] Expired subscriptions processed:', data);
      const expiredCount = data?.result?.expired_count || 0;
      
      if (expiredCount > 0) {
        toast.success(`Successfully processed ${expiredCount} expired subscription(s)`);
      } else {
        toast.info('No expired subscriptions found');
      }
      
      // Reload data to see changes
      loadData();
    } catch (error) {
      console.error('[DEBUG] Exception processing expired subscriptions:', error);
      toast.error(`Failed to process expired subscriptions: ${String(error)}`);
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

  const giftSubscriptionsCount = users.filter(user => isGiftSubscription(user)).length;

  if (isLoading) {
    return (
      <div className="bg-gradient-background min-h-screen p-4 flex items-center justify-center">
        <div className="text-foreground">Loading subscription management...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background min-h-screen text-foreground pb-20">
      {/* Header */}
      <AdminHeader
        title="Subscription Management"
        subtitle=""
        icon={<Shield className="h-5 w-5 text-accent-blue" />}
      >
        <div className="flex gap-2">
          <Button onClick={handleProcessExpiredSubscriptions} variant="outline" size="sm" className="text-xs">
            <XCircle className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Process Expired</span>
          </Button>
          <Button onClick={loadData} variant="outline" size="sm" className="text-xs">
            <RefreshCw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </AdminHeader>

      {/* Debug Info Panel */}
      {debugInfo && (
        <div className="p-4">
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-800">Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
              <Button 
                onClick={() => setDebugInfo(null)} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Clear Debug Info
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Line Style Stats */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-enhanced-heading">💳 Subscription Statistics</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-accent-blue" />
                <span className="text-sm font-medium">Total Users</span>
              </div>
              <span className="text-lg font-bold text-accent-blue">{users.length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-accent-green" />
                <span className="text-sm font-medium">Active Subscriptions</span>
              </div>
              <span className="text-lg font-bold text-accent-green">{users.filter(u => u.is_subscribed && u.subscription_status === 'active').length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <Gift className="h-4 w-4 text-accent-purple" />
                <span className="text-sm font-medium">Gift Subscriptions</span>
              </div>
              <span className="text-lg font-bold text-accent-purple">{giftSubscriptionsCount}</span>
            </div>
            
            
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
          <div className="w-full lg:w-48">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-background/50 border-border/50">
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
        </div>

        {/* Beautiful Subscription Cards */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => {
            const isGift = isGiftSubscription(user);
            const giftDuration = getGiftDuration(user);
            const remainingTime = getRemainingGiftTime(user);
            
            return (
              <Card 
                key={user.id} 
                className={`enhanced-card cursor-pointer transition-all ${
                  selectedUser?.id === user.id ? 'ring-2 ring-accent-blue' : ''
                } ${isGift ? 'border-accent-purple/30 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20' : ''}`}
                onClick={() => {
                  console.log('[DEBUG] User selected:', {
                    id: user.id,
                    email: user.email,
                    is_subscribed: user.is_subscribed,
                    subscription_status: user.subscription_status
                  });
                  setSelectedUser(user);
                }}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* User Info Row with Avatar */}
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${isGift ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-primary'} rounded-full flex items-center justify-center flex-shrink-0`}>
                        {isGift ? (
                          <Gift className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-white font-medium text-sm">
                            {(user.display_name || user.email).charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-enhanced-heading text-base">
                          {user.display_name || "No name"}
                        </h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Member since: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {selectedUser?.id === user.id && (
                          <Badge className="bg-accent-blue text-xs">Selected</Badge>
                        )}
                        {isGift && (
                          <Badge className="bg-accent-purple text-xs">
                            <Gift className="w-3 h-3 mr-1" />
                            Gift
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Subscription Information Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                      {/* Subscription Status */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-3 w-3 text-accent-green flex-shrink-0" />
                          <span className="text-xs font-medium">Subscription</span>
                        </div>
                        <div className="space-y-1">
                          {user.is_subscribed ? (
                            <Badge variant="outline" className={`text-xs w-full justify-center ${isGift ? 'border-accent-purple text-accent-purple' : 'border-accent-green text-accent-green'}`}>
                              {user.plan_name || 'Active'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs w-full justify-center">
                              Unsubscribed
                            </Badge>
                          )}
                          {user.subscription_status && (
                            <Badge variant="secondary" className="text-xs w-full justify-center">
                              {user.subscription_status}
                            </Badge>
                          )}
                          {isGift && remainingTime && (
                            <Badge variant="outline" className="text-xs w-full justify-center border-accent-purple text-accent-purple">
                              {remainingTime}
                            </Badge>
                          )}
                          {!user.is_subscribed && (
                            (() => {
                              const t = getTrialStatus(user);
                              return (
                                <Badge
                                  variant={t.expired ? 'destructive' : 'secondary'}
                                  className={`text-xs w-full justify-center ${t.expired ? '' : 'bg-green-500/10 text-green-700 border-green-500/20'}`}
                                >
                                  {t.label}
                                </Badge>
                              );
                            })()
                          )}
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          {getPaymentMethodIcon(user.payment_method, isGift)}
                          <span className="text-xs font-medium">Payment</span>
                        </div>
                        <div className="space-y-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs w-full justify-center border-current ${getPaymentMethodColor(user.payment_method, isGift)}`}
                          >
                            {getPaymentMethodLabel(user.payment_method, isGift).split(' ')[0]}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Billing Information (if subscribed) */}
                    {user.is_subscribed && (user.next_billing_date || user.billing_start_date) && (
                      <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center space-x-2 mb-2">
                          <Calendar className="h-3 w-3 text-accent-purple" />
                          <span className="text-xs font-medium">
                            {isGift ? 'Gift Info' : 'Billing Info'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          {user.billing_start_date && (
                            <div>
                              <span className="block">Started:</span>
                              <span>{new Date(user.billing_start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {user.next_billing_date && (
                            <div>
                              <span className="block">{isGift ? 'Expires:' : 'Next billing:'}</span>
                              <span>{new Date(user.next_billing_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Enhanced Action Buttons with Debug Info */}
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      {user.is_subscribed ? (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('[DEBUG] Deactivating subscription for:', user.email);
                            handleDeactivateSubscription(user);
                          }}
                          className="flex-1 text-xs hover:bg-destructive/90"
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Deactivate
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('[DEBUG] Opening activation modal for:', {
                              id: user.id,
                              email: user.email,
                              is_subscribed: user.is_subscribed
                            });
                            setSelectedUser(user);
                            setShowActivationModal(true);
                          }}
                          className="flex-1 btn-enhanced text-xs hover:shadow-glow"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Activate Subscription
                        </Button>
                      )}
                    </div>

                    {/* 30-Minute Trial Management (unsubscribed only) */}
                    {!user.is_subscribed && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleAdjustTrial(user, 'reset'); }}
                          className="text-xs"
                        >
                          <Clock className="h-3 w-3 mr-1" /> Reset Trial
                        </Button>
                        <div className="flex gap-2 items-center sm:col-span-2">
                          <Input
                            type="number"
                            min={1}
                            placeholder="minutes (e.g., 60)"
                            value={trialMinutesInput[user.id] ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setTrialMinutesInput(prev => ({ ...prev, [user.id]: e.target.value }))}
                            className="h-8 text-xs"
                          />
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleAdjustTrial(user, 'extend'); }}
                            className="text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" /> Extend Trial
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
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
