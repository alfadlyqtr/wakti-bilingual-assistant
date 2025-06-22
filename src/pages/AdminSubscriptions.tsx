
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, ArrowLeft, Search, CheckCircle, Clock, User, Crown, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubscriptionData {
  id: string;
  user_id: string;
  status: string;
  amount?: number;
  currency?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
  is_subscribed?: boolean;
  subscription_status?: string;
  plan_name?: string;
}

interface ActivationDetails {
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingCycle: string;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  
  // Activation modal states
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SubscriptionData | null>(null);
  const [activationDetails, setActivationDetails] = useState<ActivationDetails>({
    planName: 'Wakti Monthly',
    billingAmount: 60,
    billingCurrency: 'QAR',
    billingCycle: 'monthly'
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [subscriptions, searchTerm]);

  const loadSubscriptions = async () => {
    try {
      // Load all users with subscription information from profiles table, excluding deleted users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          is_subscribed,
          subscription_status,
          plan_name,
          billing_start_date,
          created_at
        `)
        .neq('suspension_reason', 'Account deleted by admin')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        throw profilesError;
      }

      // Also load actual subscription records
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (subscriptionsError) {
        console.error('Error loading subscriptions:', subscriptionsError);
      }

      // Combine data prioritizing profiles information
      const combinedData = profilesData?.map(profile => {
        const matchingSubscription = subscriptionsData?.find(sub => sub.user_id === profile.id);
        
        return {
          id: matchingSubscription?.id || profile.id,
          user_id: profile.id,
          status: profile.subscription_status || 'inactive',
          amount: matchingSubscription?.billing_amount || (profile.plan_name?.toLowerCase().includes('yearly') ? 600 : 60),
          currency: matchingSubscription?.billing_currency || 'QAR',
          created_at: profile.billing_start_date || profile.created_at,
          user_email: profile.email,
          user_name: profile.display_name,
          is_subscribed: profile.is_subscribed,
          subscription_status: profile.subscription_status,
          plan_name: profile.plan_name
        };
      }) || [];

      console.log('Combined subscription data:', combinedData);
      setSubscriptions(combinedData);
    } catch (err) {
      console.error('Error loading subscriptions:', err);
      toast.error('Failed to load subscriptions');
    } finally {
      setIsLoading(false);
    }
  };

  const filterSubscriptions = () => {
    let filtered = subscriptions;

    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSubscriptions(filtered);
  };

  const handleActivationClick = (user: SubscriptionData) => {
    setSelectedUser(user);
    setIsActivationModalOpen(true);
  };

  const confirmActivateSubscription = async () => {
    if (!selectedUser) return;
    
    setActivatingId(selectedUser.user_id);
    
    try {
      const { error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: selectedUser.user_id,
        p_plan_name: activationDetails.planName,
        p_billing_amount: activationDetails.billingAmount,
        p_billing_currency: activationDetails.billingCurrency
      });

      if (error) {
        console.error('Error activating subscription:', error);
        throw error;
      }

      // Generate PayPal subscription ID and dates
      const now = new Date();
      const paypalId = `ADMIN-MANUAL-${Date.now()}`;
      const nextBilling = new Date(now);
      if (activationDetails.billingCycle === 'yearly') {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      } else {
        nextBilling.setMonth(nextBilling.getMonth() + 1);
      }

      setSubscriptions(prev => prev.map(sub => 
        sub.user_id === selectedUser.user_id ? { 
          ...sub, 
          status: 'active',
          is_subscribed: true,
          subscription_status: 'active',
          plan_name: activationDetails.planName,
          amount: activationDetails.billingAmount
        } : sub
      ));
      
      // Show success details
      toast.success(
        `Subscription activated successfully!\n` +
        `Plan: ${activationDetails.planName}\n` +
        `Billing Start: ${now.toLocaleDateString()}\n` +
        `PayPal ID: ${paypalId}\n` +
        `Next Billing: ${nextBilling.toLocaleDateString()}`
      );
      
      setIsActivationModalOpen(false);
      loadSubscriptions(); // Refresh data
    } catch (err) {
      console.error('Error activating subscription:', err);
      toast.error('Failed to activate subscription');
    } finally {
      setActivatingId(null);
    }
  };

  const handlePlanChange = (planName: string) => {
    setActivationDetails(prev => ({
      ...prev,
      planName,
      billingAmount: planName.includes('Yearly') ? 600 : 60,
      billingCycle: planName.includes('Yearly') ? 'yearly' : 'monthly'
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin-dashboard')}
              className="rounded-full hover:bg-accent/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CreditCard className="h-8 w-8 text-accent-green" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">Subscription Control</h1>
              <p className="text-sm text-muted-foreground">Manually activate subscriptions</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user email, name, or subscription ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
        </div>

        {/* Subscription Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="enhanced-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">{subscriptions.length}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">
                {subscriptions.filter(sub => sub.is_subscribed && sub.subscription_status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Free Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">
                {subscriptions.filter(sub => !sub.is_subscribed || sub.subscription_status !== 'active').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions List */}
        <div className="grid gap-4">
          {filteredSubscriptions.map((subscription) => (
            <Card key={subscription.id} className="enhanced-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-enhanced-heading">
                        {subscription.user_name || "No name"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{subscription.user_email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge 
                          variant={subscription.is_subscribed && subscription.subscription_status === 'active' ? "default" : "outline"}
                          className={
                            subscription.is_subscribed && subscription.subscription_status === 'active' 
                              ? 'bg-accent-green text-white' 
                              : 'text-muted-foreground'
                          }
                        >
                          {subscription.is_subscribed && subscription.subscription_status === 'active' 
                            ? `Subscribed (${subscription.plan_name?.toLowerCase().includes('yearly') ? 'Y' : 'M'})` 
                            : 'Free'
                          }
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {subscription.amount} {subscription.currency?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Joined {subscription.created_at ? new Date(subscription.created_at).toLocaleDateString() : 'Unknown'}</p>
                      <p className="text-xs">ID: {subscription.id.slice(0, 8)}...</p>
                    </div>
                    
                    {(!subscription.is_subscribed || subscription.subscription_status !== 'active') && (
                      <Button
                        onClick={() => handleActivationClick(subscription)}
                        disabled={activatingId === subscription.user_id}
                        className="btn-enhanced"
                      >
                        {activatingId === subscription.user_id ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            <Crown className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                    )}
                    
                    {subscription.is_subscribed && subscription.subscription_status === 'active' && (
                      <Badge className="bg-accent-green">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSubscriptions.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Activation Modal */}
      <Dialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5" />
              <span>Activate Subscription</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded">
                <h3 className="font-medium">{selectedUser.user_name || "No name"}</h3>
                <p className="text-sm text-muted-foreground">{selectedUser.user_email}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Plan</label>
                  <Select value={activationDetails.planName} onValueChange={handlePlanChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wakti Monthly">Wakti Monthly (60 QAR/month)</SelectItem>
                      <SelectItem value="Wakti Yearly">Wakti Yearly (600 QAR/year)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Amount</label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm">
                      {activationDetails.billingAmount} {activationDetails.billingCurrency}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Cycle</label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm capitalize">
                      {activationDetails.billingCycle}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Subscription Details</span>
                  </div>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>Billing Start Date:</strong> {new Date().toLocaleDateString()}</p>
                    <p><strong>PayPal Subscription ID:</strong> ADMIN-MANUAL-{Date.now()}</p>
                    <p><strong>Next Billing Date:</strong> {
                      (() => {
                        const next = new Date();
                        if (activationDetails.billingCycle === 'yearly') {
                          next.setFullYear(next.getFullYear() + 1);
                        } else {
                          next.setMonth(next.getMonth() + 1);
                        }
                        return next.toLocaleDateString();
                      })()
                    }</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsActivationModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={confirmActivateSubscription}
                  disabled={activatingId === selectedUser.user_id}
                  className="flex items-center space-x-2"
                >
                  <DollarSign className="h-4 w-4" />
                  <span>{activatingId === selectedUser.user_id ? "Activating..." : "Activate Subscription"}</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
