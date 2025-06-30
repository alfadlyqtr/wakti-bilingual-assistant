
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Users, Search, Filter, CheckCircle, XCircle, AlertTriangle, RefreshCw, CreditCard, Smartphone, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activationData, setActivationData] = useState({
    planName: "Monthly Plan",
    billingAmount: 60,
    paymentMethod: "manual", // Default to manual for admin activation
    paypalSubscriptionId: ""
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
      // Validate PayPal ID if PayPal method is selected
      if (activationData.paymentMethod === 'paypal' && !activationData.paypalSubscriptionId.trim()) {
        toast.error('PayPal Subscription ID is required for PayPal activations');
        return;
      }

      const { error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: selectedUser.id,
        p_plan_name: activationData.planName,
        p_billing_amount: activationData.billingAmount,
        p_billing_currency: 'QAR',
        p_payment_method: activationData.paymentMethod,
        p_paypal_subscription_id: activationData.paymentMethod === 'paypal' ? activationData.paypalSubscriptionId : null,
        p_fawran_payment_id: null // Manual activation, no Fawran payment ID
      });

      if (error) throw error;

      toast.success(`Subscription activated for ${selectedUser.email}`);
      setSelectedUser(null);
      setActivationData({
        planName: "Monthly Plan",
        billingAmount: 60,
        paymentMethod: "manual",
        paypalSubscriptionId: ""
      });
      loadData();
    } catch (error) {
      console.error('Error activating subscription:', error);
      toast.error('Failed to activate subscription');
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'fawran':
        return <Smartphone className="h-4 w-4 text-accent-green" />;
      case 'paypal':
        return <CreditCard className="h-4 w-4 text-accent-blue" />;
      case 'manual':
        return <UserCog className="h-4 w-4 text-accent-orange" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'fawran':
        return 'Fawran (AI-Verified)';
      case 'paypal':
        return 'PayPal (Legacy)';
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
    <div className="bg-gradient-background min-h-screen text-foreground">
      {/* Header */}
      <div className="bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Shield className="h-5 w-5 text-accent-blue" />
            <div>
              <h1 className="text-lg font-bold text-enhanced-heading">Subscription Management</h1>
              <p className="text-sm text-muted-foreground">Dual Payment System: PayPal Legacy + Fawran Modern</p>
            </div>
          </div>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <Users className="h-4 w-4 mr-2 text-accent-blue" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">{users.length}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <CheckCircle className="h-4 w-4 mr-2 text-accent-green" />
                Active Subscribers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-green">
                {users.filter(u => u.is_subscribed && u.subscription_status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
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
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-sm">
                <CreditCard className="h-4 w-4 mr-2 text-accent-orange" />
                PayPal Legacy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent-orange">
                {users.filter(u => u.payment_method === 'paypal').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Controls */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">User Management</CardTitle>
            <CardDescription>Search users and manage their subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Label htmlFor="search">Search Users</Label>
                <Input
                  id="search"
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="w-full sm:w-48">
                <Label>Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1">
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

            {/* Users List */}
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-border transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getPaymentMethodIcon(user.payment_method)}
                      <div>
                        <div className="font-medium text-enhanced-heading">{user.email}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.display_name} • {getPaymentMethodLabel(user.payment_method)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {user.is_subscribed ? (
                      <Badge variant="secondary" className="bg-accent-green/20 text-accent-green">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {user.plan_name}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-muted/20">
                        <XCircle className="h-3 w-3 mr-1" />
                        Unsubscribed
                      </Badge>
                    )}
                    
                    {!user.is_subscribed && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            onClick={() => setSelectedUser(user)}
                            className="btn-enhanced"
                          >
                            Activate
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Activate Subscription</DialogTitle>
                            <DialogDescription>
                              Activate subscription for {user.email}
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
                                  <SelectItem value="paypal">PayPal Legacy System</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {activationData.paymentMethod === 'paypal' && (
                              <div>
                                <Label>PayPal Subscription ID</Label>
                                <Input
                                  placeholder="Enter PayPal subscription ID..."
                                  value={activationData.paypalSubscriptionId}
                                  onChange={(e) => setActivationData(prev => ({...prev, paypalSubscriptionId: e.target.value}))}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Required for PayPal legacy activations
                                </p>
                              </div>
                            )}
                            
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
                            <Button variant="outline" onClick={() => setSelectedUser(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleActivateSubscription} className="btn-enhanced">
                              Activate Subscription
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
