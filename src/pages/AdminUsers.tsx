import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, RefreshCw, Search, Shield, Users, User, Mail, Calendar, Clock, Activity, Crown, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  is_suspended: boolean;
  email_confirmed: boolean;
  suspended_at?: string;
  suspended_until?: string;
  suspension_reason?: string;
  subscription_status?: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [featureUsage, setFeatureUsage] = useState<any[] | null>(null);
  const [usageMonth, setUsageMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [usageScope, setUsageScope] = useState<'month' | 'lifetime'>('lifetime');
  const [showSubs, setShowSubs] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          is_suspended,
          email_confirmed,
          suspended_at,
          suspended_until,
          suspension_reason,
          subscription_status,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AdminUsers] Database error:', error);
        toast.error(`Database error: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[AdminUsers] No users found in database');
        toast.info('No users found in the database');
        setUsers([]);
        return;
      }
      
      const processedUsers = data.map(user => ({
        ...user,
        email: user.email || '',
        full_name: user.display_name || 'Unknown User',
        display_name: user.display_name || 'Unknown User',
        email_confirmed: user.email_confirmed ?? false,
        is_suspended: user.is_suspended ?? false
      }));
      
      setUsers(processedUsers);
      toast.success(`Loaded ${processedUsers.length} users successfully`);
    } catch (error) {
      console.error('[AdminUsers] Exception:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_suspended: !selectedUser.is_suspended,
          suspended_at: !selectedUser.is_suspended ? new Date().toISOString() : null,
          suspension_reason: !selectedUser.is_suspended ? 'Admin action' : null
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success(`User ${selectedUser.is_suspended ? 'unsuspended' : 'suspended'} successfully`);
      setShowSuspendConfirm(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: '[DELETED USER]',
          email: null
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "active") return matchesSearch && !user.is_suspended;
    if (filterStatus === "suspended") return matchesSearch && user.is_suspended;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader 
        title="User Management"
        icon={<Users className="h-5 w-5" />}
      >
        <Button onClick={loadUsers} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      <div className="p-4 space-y-6">
        {/* User Statistics */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">📊 User Statistics</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Total Users</span>
              </div>
              <span className="text-lg font-bold text-blue-500">{users.length}</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Active Users</span>
              </div>
              <span className="text-lg font-bold text-green-500">{users.filter(u => !u.is_suspended).length}</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Suspended Users</span>
              </div>
              <span className="text-lg font-bold text-red-500">{users.filter(u => u.is_suspended).length}</span>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full lg:w-48">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Users</SelectItem>
                <SelectItem value="suspended">Suspended Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User Cards */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">No users found</div>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{user.display_name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {user.is_suspended ? 'Suspended' : 'Active'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setSelectedUser(user);
                        setShowDetails(true);
                        setDetailsLoading(true);
                        setUserDetails(null);
                        setFeatureUsage(null);
                        try {
                          const { data, error } = await (supabase as any).rpc('admin_get_user_full_profile', {
                            p_user_id: user.id,
                            p_plan_name: null,
                            p_from: null,
                            p_to: null,
                          });
                          if (error) {
                            console.error('[AdminUsers] Failed to load user details:', error);
                            toast.error(`Failed to load user details: ${error.message}`);
                          } else {
                            setUserDetails(data);
                            try {
                              const { data: fu, error: fue } = await (supabase as any).rpc('admin_get_user_usage', {
                                p_user_id: user.id,
                                p_scope: usageScope,
                                p_month: usageMonth,
                              });
                              if (!fue && Array.isArray(fu)) {
                                setFeatureUsage(fu);
                              } else {
                                setFeatureUsage([]);
                              }
                            } catch (e) {
                              console.error('[AdminUsers] Feature usage fetch error:', e);
                              setFeatureUsage([]);
                            }
                          }
                        } catch (err) {
                          console.error('[AdminUsers] Exception loading user details:', err);
                          toast.error('Error loading user details');
                        } finally {
                          setDetailsLoading(false);
                        }
                      }}
                    >
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isImpersonating}
                      onClick={async () => {
                        setIsImpersonating(true);
                        try {
                          const reason = `Admin viewing user context from Users page`;
                          const { data, error } = await (supabase as any).rpc('admin_start_impersonation', {
                            p_user_id: user.id,
                            p_reason: reason,
                          });
                          if (error) {
                            console.error('[AdminUsers] Failed to start impersonation:', error);
                            toast.error(`Failed to log impersonation: ${error.message}`);
                          } else {
                            const context = {
                              userEmail: user.email,
                              reason,
                              eventId: data?.event_id,
                              startedAt: data?.started_at,
                            };
                            try {
                              localStorage.setItem('admin_impersonation_context', JSON.stringify(context));
                            } catch {
                              // ignore storage errors
                            }
                            toast.success(`Impersonation context started for ${user.email}`);
                          }
                        } catch (err) {
                          console.error('[AdminUsers] Exception starting impersonation:', err);
                          toast.error('Error starting impersonation context');
                        } finally {
                          setIsImpersonating(false);
                        }
                      }}
                    >
                      Impersonation
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowSuspendConfirm(true);
                      }}
                    >
                      {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={showSuspendConfirm} onOpenChange={setShowSuspendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.is_suspended ? 'Unsuspend' : 'Suspend'} User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to {selectedUser?.is_suspended ? 'unsuspend' : 'suspend'} {selectedUser?.display_name}?</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setShowSuspendConfirm(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSuspendUser}>
              {selectedUser?.is_suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete {selectedUser?.display_name}? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setShowDeleteConfirm(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={showDetails} onOpenChange={(open) => {
        setShowDetails(open);
        if (!open) {
          setUserDetails(null);
          setFeatureUsage(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {detailsLoading && (
              <div className="text-sm text-muted-foreground">Loading details...</div>
            )}
            {!detailsLoading && !userDetails && (
              <div className="text-sm text-muted-foreground">No details available.</div>
            )}
            {!detailsLoading && userDetails && (
              <div className="space-y-4 text-sm">
                {/* Enhanced Profile Header with Avatar */}
                <div className="border rounded-md p-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {userDetails.profile?.avatar_url ? (
                        <img
                          src={userDetails.profile.avatar_url}
                          alt={userDetails.profile?.display_name || 'User'}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-xl">
                          {(userDetails.profile?.display_name || userDetails.profile?.email || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold truncate">
                          {userDetails.profile?.display_name || 'No name'}
                        </h3>
                        {/* Online Status */}
                        {userDetails.profile?.is_online ? (
                          <Badge className="bg-green-500 text-white text-xs">
                            <Activity className="h-3 w-3 mr-1" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Offline</Badge>
                        )}
                      </div>
                      
                      <p className="text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {userDetails.profile?.email || '—'}
                      </p>
                      
                      {/* Status Badges */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={userDetails.profile?.is_suspended ? "destructive" : "default"} className="text-xs">
                          {userDetails.profile?.is_suspended ? 'Suspended' : 'Active'}
                        </Badge>
                        <Badge variant={userDetails.profile?.email_confirmed ? "default" : "outline"} className="text-xs">
                          {userDetails.profile?.email_confirmed ? (
                            <><CheckCircle className="h-3 w-3 mr-1" />Verified</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1" />Unverified</>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Dates Row */}
                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Member Since
                      </p>
                      <p className="font-medium">
                        {userDetails.profile?.created_at 
                          ? new Date(userDetails.profile.created_at).toLocaleDateString()
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {userDetails.profile?.created_at 
                          ? formatDistanceToNow(new Date(userDetails.profile.created_at), { addSuffix: true })
                          : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last Active
                      </p>
                      <p className="font-medium">
                        {userDetails.profile?.last_login_at 
                          ? formatDistanceToNow(new Date(userDetails.profile.last_login_at), { addSuffix: true })
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subscription Info */}
                <div className="border rounded-md p-3">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    Subscription
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {userDetails.profile?.is_subscribed || (userDetails.subscriptions && userDetails.subscriptions.length > 0) ? (
                      <>
                        <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                          <CreditCard className="h-3 w-3 mr-1" />
                          Subscribed
                        </Badge>
                        {userDetails.profile?.plan_name && (
                          <Badge variant="outline">{userDetails.profile.plan_name}</Badge>
                        )}
                        {userDetails.subscriptions?.[0]?.plan_name && !userDetails.profile?.plan_name && (
                          <Badge variant="outline">{userDetails.subscriptions[0].plan_name}</Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="secondary">Free Plan</Badge>
                    )}
                  </div>
                  {userDetails.subscriptions?.[0] && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>Status: {userDetails.subscriptions[0].status}</p>
                      {userDetails.subscriptions[0].current_period_end && (
                        <p>Renews: {new Date(userDetails.subscriptions[0].current_period_end).toLocaleDateString()}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="border rounded-md p-3">
                  <h4 className="font-semibold mb-2">Voice Usage</h4>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="ml-2 font-medium">{(() => { const v = featureUsage?.find((u:any) => u.feature === 'voice')?.used ?? 0; return v?.toLocaleString?.() ?? v; })()} characters</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Usage Period</h4>
                  {usageScope === 'month' && (
                    <input
                      type="month"
                      value={usageMonth}
                      onChange={async (e) => {
                        const value = e.target.value; // YYYY-MM
                        setUsageMonth(value);
                        try {
                          const { data: fu, error: fue } = await (supabase as any).rpc('admin_get_user_usage', {
                            p_user_id: selectedUser?.id,
                            p_scope: usageScope,
                            p_month: value,
                          });
                          if (!fue && Array.isArray(fu)) {
                            setFeatureUsage(fu);
                          } else {
                            setFeatureUsage([]);
                          }
                        } catch (e) {
                          console.error('[AdminUsers] Feature usage fetch error (month change):', e);
                          setFeatureUsage([]);
                        }
                      }}
                      className="h-8 rounded border px-2 text-xs bg-background"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={`px-2 py-1 rounded text-xs border ${usageScope === 'month' ? 'bg-accent text-accent-foreground' : 'bg-background'}`}
                    onClick={async () => {
                      setUsageScope('month');
                      try {
                        const { data: fu, error: fue } = await (supabase as any).rpc('admin_get_user_usage', {
                          p_user_id: selectedUser?.id,
                          p_scope: 'month',
                          p_month: usageMonth,
                        });
                        if (!fue && Array.isArray(fu)) setFeatureUsage(fu); else setFeatureUsage([]);
                      } catch (e) { setFeatureUsage([]); }
                    }}
                  >
                    This Month
                  </button>
                  <button
                    className={`px-2 py-1 rounded text-xs border ${usageScope === 'lifetime' ? 'bg-accent text-accent-foreground' : 'bg-background'}`}
                    onClick={async () => {
                      setUsageScope('lifetime');
                      try {
                        const { data: fu, error: fue } = await (supabase as any).rpc('admin_get_user_usage', {
                          p_user_id: selectedUser?.id,
                          p_scope: 'lifetime',
                          p_month: usageMonth,
                        });
                        if (!fue && Array.isArray(fu)) setFeatureUsage(fu); else setFeatureUsage([]);
                      } catch (e) { setFeatureUsage([]); }
                    }}
                  >
                    Lifetime
                  </button>
                </div>

                <div className="border rounded-md p-3">
                  <h4 className="font-semibold mb-2">Feature Usage {usageScope === 'lifetime' ? '(lifetime)' : '(this month)'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {(() => {
                      const get = (key: string) => featureUsage?.find((u:any) => u.feature === key) || {};
                      const rows = [
                        { key: 'voice', label: 'Voice', value: (get('voice').used ?? 0), unit: 'characters' },
                        { key: 'chat', label: 'Chat', value: (get('chat').used ?? 0), unit: 'tokens' },
                        { key: 'images', label: 'Images', value: (get('images').used ?? 0), unit: 'images' },
                        { key: 'search', label: 'Search', value: (get('search').used ?? 0), unit: 'searches', extra: get('search') },
                        { key: 'music', label: 'Music', value: (get('music').tracks ?? 0), unit: 'tracks', extra: get('music') },
                        { key: 'voice_translation', label: 'Voice translation', value: (get('voice_translation').used ?? 0), unit: 'translations' },
                      ];
                      return rows.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="font-medium">
                            {r.key === 'music' ? `${r.value} tracks${r.extra?.chars_used ? ` • ${r.extra.chars_used} chars` : ''}` :
                             r.key === 'search' ? `${r.value} searches${(r.extra?.extra_regular||0)+(r.extra?.extra_advanced||0) > 0 ? ` • ${r.extra?.extra_regular||0} extra • ${r.extra?.extra_advanced||0} advanced` : ''}` :
                             `${r.value} ${r.unit}`}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Subscriptions</h4>
                    <button className="text-xs underline" onClick={() => setShowSubs(!showSubs)}>
                      {showSubs ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showSubs && (
                    Array.isArray(userDetails.subscriptions) && userDetails.subscriptions.length > 0 ? (
                      <div className="space-y-2 mt-2">
                        {userDetails.subscriptions.map((s: any, idx: number) => (
                          <div key={idx} className="border border-border/50 rounded p-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{s.plan_name || 'Plan'}</div>
                              <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-muted text-foreground/70'}`}>{s.status}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1 mt-2">
                              <span className="text-muted-foreground">Amount</span>
                              <span>{(s.billing_amount ?? 0).toFixed ? s.billing_amount.toFixed(2) : s.billing_amount} {s.billing_currency || ''}</span>
                              <span className="text-muted-foreground">Start</span>
                              <span>{s.start_date ? new Date(s.start_date).toLocaleDateString() : '—'}</span>
                              <span className="text-muted-foreground">Next Billing</span>
                              <span>{s.next_billing_date ? new Date(s.next_billing_date).toLocaleDateString() : '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">No subscriptions found.</p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => {
              setShowDetails(false);
              setUserDetails(null);
            }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AdminMobileNav />
    </div>
  );
}
