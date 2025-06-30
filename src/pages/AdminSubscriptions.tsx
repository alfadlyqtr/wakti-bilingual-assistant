

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Search, Filter, CheckCircle, XCircle, AlertTriangle, RefreshCw, Smartphone, UserCog, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

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
  paypal_subscription_id: string;
  created_at: string;
}

// Protected legacy PayPal users
const LEGACY_PAYPAL_USERS = [
  'ahmadalsayyed40@gmail.com',
  'alfadly@tmw.qa',
  'albuhaddoudhilal@gmail.com',
  'alanoud.qtr6@gmail.com',
  'mohamedbingha974@gmail.com'
];

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationData, setActivationData] = useState({
    planName: "Monthly Plan",
    billingAmount: 60,
    paymentMethod: "manual"
  });

  useEffect(() => {
    validateAdminSession();
    loadData();
  }, []);

  const validateAdminSession = async () => {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      navigate('/mqtr');
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        navigate('/mqtr');
        return;
      }
    } catch (err) {
      navigate('/mqtr');
    }
  };

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

  const handleActivateSubscription = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: selectedUser.id,
        p_plan_name: activationData.planName,
        p_billing_amount: activationData.billingAmount,
        p_billing_currency: 'QAR',
        p_payment_method: activationData.paymentMethod,
        p_paypal_subscription_id: null,
        p_fawran_payment_id: null
      });

      if (error) throw error;

      toast.success(`Subscription activated for ${selectedUser.email}`);
      setShowActivationModal(false);
      setSelectedUser(null);
      setActivationData({
        planName: "Monthly Plan",
        billingAmount: 60,
        paymentMethod: "manual"
      });
      loadData();
    } catch (error) {
      console.error('Error activating subscription:', error);
      toast.error('Failed to activate subscription');
    }
  };

  const handleDeactivateSubscription = async (user: User) => {
    if (LEGACY_PAYPAL_USERS.includes(user.email)) {
      toast.error('Cannot deactivate protected legacy PayPal users');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: false,
          subscription_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Also update the subscription record
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id);

      toast.success(`Subscription deactivated for ${user.email}`);
      loadData();
    } catch (error) {
      console.error('Error deactivating subscription:', error);
      toast.error('Failed to deactivate subscription');
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'fawran':
        return <Smartphone className="h-4 w-4 text-accent-green" />;
      case 'manual':
        return <UserCog className="h-4 w-4 text-accent-orange" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPaymentMethodLabel = (method: string, email: string) => {
    if (LEGACY_PAYPAL_USERS.includes(email)) {
      return 'PayPal Legacy (Protected)';
    }
    switch (method) {
      case 'fawran':
        return 'Fawran (AI-Verified)';
      case 'manual':
        return 'Manual Admin';
      default:
        return 'Legacy/Unknown';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "all" || 
      (filterStatus === "subscribed" && user.is_subscribed) ||
      (filterStatus === "unsubscribed" && !user.is_subscribed);
    
    return matchesSearch && matchesFilter;
  });

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
        subtitle="Dual Payment System: Fawran Modern + Legacy PayPal Protection"
        icon={<Shield className="h-5 w-5 text-accent-blue" />}
      >
        <Button onClick={loadData} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-blue" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-enhanced-heading">{users.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-green/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-green" />
                Active Subs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-accent-green">
                {users.filter(u => u.is_subscribed && u.subscription_status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <Smartphone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-purple" />
                Fawran Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-accent-purple">
                {users.filter(u => u.payment_method === 'fawran').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <UserCog className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-orange" />
                Legacy Protected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-accent-orange">
                {users.filter(u => LEGACY_PAYPAL_USERS.includes(u.email)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filter Controls */}
        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="text-enhanced-heading text-sm sm:text-base">User Management</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Search users and manage their subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex-1">
                <Label htmlFor="search" className="text-xs sm:text-sm">Search Users</Label>
                <Input
                  id="search"
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1 text-xs sm:text-sm bg-background/50 border-border/50 focus:border-accent-blue/50"
                />
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs sm:text-sm">Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1 text-xs sm:text-sm bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="subscribed">Subscribed</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Enhanced Users List */}
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-gradient-card border border-border/30 rounded-xl p-4 hover:border-border/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        {getPaymentMethodIcon(user.payment_method)}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-enhanced-heading text-sm sm:text-base truncate">{user.email}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground truncate">
                            {user.display_name} • {getPaymentMethodLabel(user.payment_method, user.email)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
                      {user.is_subscribed ? (
                        <>
                          <Badge variant="secondary" className="bg-accent-green/20 text-accent-green text-xs border-accent-green/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {user.plan_name || 'Active'}
                          </Badge>
                          {!LEGACY_PAYPAL_USERS.includes(user.email) && (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleDeactivateSubscription(user)}
                              className="text-xs px-2 sm:px-3 hover:bg-destructive/90"
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">Deactivate</span>
                            </Button>
                          )}
                          {LEGACY_PAYPAL_USERS.includes(user.email) && (
                            <Badge variant="outline" className="text-xs text-accent-orange border-accent-orange">
                              Protected
                            </Badge>
                          )}
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="bg-muted/20 text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Unsubscribed
                          </Badge>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowActivationModal(true);
                            }}
                            className="btn-enhanced text-xs px-2 sm:px-3 hover:shadow-glow"
                          >
                            Activate
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activation Modal */}
      <Dialog open={showActivationModal} onOpenChange={setShowActivationModal}>
        <DialogContent className="max-w-sm sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">Activate Subscription</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Activate subscription for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs sm:text-sm">Plan Type</Label>
              <Select 
                value={activationData.planName} 
                onValueChange={(value) => setActivationData(prev => ({
                  ...prev, 
                  planName: value,
                  billingAmount: value.includes('Yearly') ? 600 : 60
                }))}
              >
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly Plan">Monthly Plan (60 QAR)</SelectItem>
                  <SelectItem value="Yearly Plan">Yearly Plan (600 QAR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs sm:text-sm">Payment Method</Label>
              <Select 
                value={activationData.paymentMethod} 
                onValueChange={(value) => setActivationData(prev => ({...prev, paymentMethod: value}))}
              >
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Admin Activation</SelectItem>
                  <SelectItem value="fawran">Fawran (when linked to payment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs sm:text-sm">Billing Amount</Label>
              <Input
                type="number"
                value={activationData.billingAmount}
                onChange={(e) => setActivationData(prev => ({...prev, billingAmount: Number(e.target.value)}))}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowActivationModal(false);
                setSelectedUser(null);
              }}
              size="sm" 
              className="text-xs"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleActivateSubscription}
              className="btn-enhanced text-xs hover:shadow-glow" 
              size="sm"
            >
              Activate Subscription
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
