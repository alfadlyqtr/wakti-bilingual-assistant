
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Search, Filter, CheckCircle, XCircle, AlertTriangle, RefreshCw, Smartphone, UserCog, UserX, CreditCard, Calendar } from "lucide-react";
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

  const getPaymentMethodColor = (method: string, email: string) => {
    if (LEGACY_PAYPAL_USERS.includes(email)) {
      return 'text-accent-blue';
    }
    switch (method) {
      case 'fawran':
        return 'text-accent-green';
      case 'manual':
        return 'text-accent-orange';
      default:
        return 'text-muted-foreground';
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
      <div className="p-4 space-y-6">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <Users className="h-4 w-4 mr-2 text-accent-blue" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">{users.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-green/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <CheckCircle className="h-4 w-4 mr-2 text-accent-green" />
                Active Subs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-green">
                {users.filter(u => u.is_subscribed && u.subscription_status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <Smartphone className="h-4 w-4 mr-2 text-accent-purple" />
                Fawran Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-purple">
                {users.filter(u => u.payment_method === 'fawran').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <UserCog className="h-4 w-4 mr-2 text-accent-orange" />
                Legacy Protected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-orange">
                {users.filter(u => LEGACY_PAYPAL_USERS.includes(u.email)).length}
              </div>
            </CardContent>
          </Card>
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
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Beautiful Subscription Cards - Quota Management Style */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card 
              key={user.id} 
              className={`enhanced-card cursor-pointer transition-all ${
                selectedUser?.id === user.id ? 'ring-2 ring-accent-blue' : ''
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* User Info Row with Avatar */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">
                        {(user.display_name || user.email).charAt(0).toUpperCase()}
                      </span>
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
                    {selectedUser?.id === user.id && (
                      <Badge className="bg-accent-blue text-xs flex-shrink-0">Selected</Badge>
                    )}
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
                          <Badge variant="outline" className="text-xs w-full justify-center border-accent-green text-accent-green">
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
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        {getPaymentMethodIcon(user.payment_method)}
                        <span className="text-xs font-medium">Payment</span>
                      </div>
                      <div className="space-y-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs w-full justify-center border-current ${getPaymentMethodColor(user.payment_method, user.email)}`}
                        >
                          {getPaymentMethodLabel(user.payment_method, user.email).split(' ')[0]}
                        </Badge>
                        {LEGACY_PAYPAL_USERS.includes(user.email) && (
                          <Badge variant="secondary" className="text-xs w-full justify-center text-accent-orange">
                            Protected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billing Information (if subscribed) */}
                  {user.is_subscribed && (user.next_billing_date || user.billing_start_date) && (
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calendar className="h-3 w-3 text-accent-purple" />
                        <span className="text-xs font-medium">Billing Info</span>
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
                            <span className="block">Next billing:</span>
                            <span>{new Date(user.next_billing_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    {user.is_subscribed ? (
                      <>
                        {!LEGACY_PAYPAL_USERS.includes(user.email) && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeactivateSubscription(user);
                            }}
                            className="flex-1 text-xs hover:bg-destructive/90"
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            Deactivate
                          </Button>
                        )}
                        {LEGACY_PAYPAL_USERS.includes(user.email) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled
                            className="flex-1 text-xs"
                          >
                            Protected User
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
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
                </div>
              </CardContent>
            </Card>
          ))}
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

      {/* Activation Modal */}
      <Dialog open={showActivationModal} onOpenChange={setShowActivationModal}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Activate Subscription</DialogTitle>
            <DialogDescription>
              Activate subscription for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                <SelectContent>
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
                <SelectContent>
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
            >
              Cancel
            </Button>
            <Button 
              onClick={handleActivateSubscription}
              className="btn-enhanced hover:shadow-glow"
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
