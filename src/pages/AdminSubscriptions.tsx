import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Search, CheckCircle, Clock, User, Crown, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  next_billing_date?: string;
}

interface ActivationDetails {
  planName: string;
  billingAmount: number;
  billingCurrency: string;
  billingCycle: string;
  billingStartDate: string;
  paypalSubscriptionId: string;
  paypalPlanId: string;
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
    billingCycle: 'monthly',
    billingStartDate: new Date().toISOString().split('T')[0],
    paypalSubscriptionId: '',
    paypalPlanId: 'P-5RM543441H466435NNBGLCWA'
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [subscriptions, searchTerm]);

  const loadSubscriptions = async () => {
    try {
      setIsLoading(true);
      
      console.log('Loading subscriptions from database...');
      
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
          next_billing_date,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        throw profilesError;
      }

      console.log('Raw profiles data from database:', profilesData);

      const combinedData = profilesData?.map(profile => {
        return {
          id: profile.id,
          user_id: profile.id,
          status: profile.subscription_status || 'inactive',
          amount: profile.plan_name?.toLowerCase().includes('yearly') ? 600 : 60,
          currency: 'QAR',
          created_at: profile.billing_start_date || profile.created_at,
          user_email: profile.email || 'No email',
          user_name: profile.display_name || 'No name',
          is_subscribed: profile.is_subscribed || false,
          subscription_status: profile.subscription_status || 'inactive',
          plan_name: profile.plan_name,
          next_billing_date: profile.next_billing_date
        };
      }) || [];

      console.log('Combined subscription data:', combinedData);
      console.log('Total users loaded for subscriptions:', combinedData.length);
      
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
    setActivationDetails({
      planName: 'Wakti Monthly',
      billingAmount: 60,
      billingCurrency: 'QAR',
      billingCycle: 'monthly',
      billingStartDate: new Date().toISOString().split('T')[0],
      paypalSubscriptionId: '',
      paypalPlanId: 'P-5RM543441H466435NNBGLCWA'
    });
    setIsActivationModalOpen(true);
  };

  const confirmActivateSubscription = async () => {
    if (!selectedUser) return;
    
    // Validate PayPal Subscription ID is provided
    if (!activationDetails.paypalSubscriptionId.trim()) {
      toast.error('PayPal Subscription ID is required');
      return;
    }
    
    setActivatingId(selectedUser.user_id);
    
    try {
      const { error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: selectedUser.user_id,
        p_plan_name: activationDetails.planName,
        p_billing_amount: activationDetails.billingAmount,
        p_billing_currency: activationDetails.billingCurrency,
        p_paypal_plan_id: activationDetails.paypalPlanId
      });

      if (error) {
        console.error('Error activating subscription:', error);
        throw error;
      }

      // Update the user's PayPal subscription ID in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ paypal_subscription_id: activationDetails.paypalSubscriptionId.trim() })
        .eq('id', selectedUser.user_id);

      if (updateError) {
        console.error('Error updating PayPal subscription ID:', updateError);
        toast.error('Failed to update PayPal subscription ID');
        return;
      }

      const now = new Date(activationDetails.billingStartDate);
      const nextBilling = new Date(now);
      if (activationDetails.billingCycle === 'yearly') {
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      } else if (activationDetails.planName.includes('1 week')) {
        nextBilling.setDate(nextBilling.getDate() + 7);
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
          amount: activationDetails.billingAmount,
          next_billing_date: nextBilling.toISOString()
        } : sub
      ));
      
      toast.success(
        `Subscription activated successfully!\n` +
        `Plan: ${activationDetails.planName}\n` +
        `Billing Start: ${now.toLocaleDateString()}\n` +
        `PayPal ID: ${activationDetails.paypalSubscriptionId}\n` +
        `Next Billing: ${nextBilling.toLocaleDateString()}`
      );
      
      setIsActivationModalOpen(false);
      loadSubscriptions();
    } catch (err) {
      console.error('Error activating subscription:', err);
      toast.error('Failed to activate subscription');
    } finally {
      setActivatingId(null);
    }
  };

  const handlePlanChange = (planName: string) => {
    let amount = 60;
    let cycle = 'monthly';
    let paypalPlanId = 'P-5RM543441H466435NNBGLCWA'; // Default monthly plan

    if (planName.includes('Yearly')) {
      amount = 600;
      cycle = 'yearly';
      paypalPlanId = 'P-5V753699962632454NBGLE6Y'; // Yearly plan
    } else if (planName.includes('Gift from Admin')) {
      amount = 0; // Free gift plans
      cycle = planName.includes('1 week') ? 'weekly' : 'monthly';
      paypalPlanId = 'ADMIN-GIFT-PLAN'; // Special ID for gift plans
    }

    setActivationDetails(prev => ({
      ...prev,
      planName,
      billingAmount: amount,
      billingCycle: cycle,
      paypalPlanId
    }));
  };

  const handleBackToAdmin = () => {
    console.log('AD button clicked - FIXED NAVIGATION to /admindash');
    console.log('Current location:', window.location.href);
    navigate('/admindash');
    console.log('Navigation called to /admindash (CORRECTED FROM /admin-dashboard)');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading subscriptions...</div>
      </div>
    );
  }

  // Focus on subscribed users and expiring soon
  const subscribedUsers = filteredSubscriptions.filter(sub => sub.is_subscribed && sub.subscription_status === 'active');
  const freeUsers = filteredSubscriptions.filter(sub => !sub.is_subscribed || sub.subscription_status !== 'active');
  const expiringUsers = subscribedUsers.filter(sub => {
    if (!sub.next_billing_date) return false;
    const nextBilling = new Date(sub.next_billing_date);
    const now = new Date();
    const daysDiff = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return daysDiff <= 7 && daysDiff >= 0;
  });

  return (
    <div className="min-h-screen bg-gradient-background text-foreground flex flex-col">
      {/* Mobile Responsive Header */}
      <header className="flex-shrink-0 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAdmin}
              className="rounded-full hover:bg-accent/10 font-bold text-sm sm:text-lg px-2 sm:px-3"
            >
              AD
            </Button>
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-accent-green" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-enhanced-heading">Subscription Control</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Focus on subscribed users and expiring subscriptions</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-3 sm:p-6 pb-32">
        {/* Mobile Responsive Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user email, name, or subscription ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced text-sm"
            />
          </div>
        </div>

        {/* Mobile Responsive Subscription Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-enhanced-heading">{filteredSubscriptions.length}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-accent-green">{subscribedUsers.length}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Expiring Soon (7 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-accent-orange">{expiringUsers.length}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Free Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-enhanced-heading">{freeUsers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Subscribed Users Section */}
        {subscribedUsers.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-enhanced-heading mb-3 sm:mb-4">Active Subscribers ({subscribedUsers.length})</h2>
            <div className="grid gap-3 sm:gap-4">
              {subscribedUsers.map((subscription) => {
                const isGifted = subscription.plan_name?.toLowerCase().includes('gift') || 
                                subscription.plan_name?.toLowerCase().includes('admin');
                
                return (
                  <Card key={subscription.id} className="enhanced-card border-accent-green/20">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-enhanced-heading text-sm sm:text-base truncate">
                              {subscription.user_name || "No name"}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{subscription.user_email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge className={isGifted ? "bg-accent-purple text-white text-xs" : "bg-accent-green text-white text-xs"}>
                                {isGifted ? 'Gift from Admin' : 
                                 subscription.plan_name?.toLowerCase().includes('yearly') ? 'Yearly' : 'Monthly'} Subscriber
                              </Badge>
                              {!isGifted && (
                                <span className="text-xs text-muted-foreground">
                                  {subscription.amount} {subscription.currency?.toUpperCase()}
                                </span>
                              )}
                              {subscription.next_billing_date && (
                                <span className="text-xs text-muted-foreground">
                                  Next: {new Date(subscription.next_billing_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-accent-green self-start sm:self-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Free Users Section */}
        {freeUsers.length > 0 && (
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-enhanced-heading mb-3 sm:mb-4">Free Users ({freeUsers.length})</h2>
            <div className="grid gap-3 sm:gap-4">
              {freeUsers.map((subscription) => (
                <Card key={subscription.id} className="enhanced-card">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-enhanced-heading text-sm sm:text-base truncate">
                            {subscription.user_name || "No name"}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{subscription.user_email}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Free User
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Joined {subscription.created_at ? new Date(subscription.created_at).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleActivationClick(subscription)}
                        disabled={activatingId === subscription.user_id}
                        className="btn-enhanced text-sm sm:text-base self-start sm:self-center"
                        size="sm"
                      >
                        {activatingId === subscription.user_id ? (
                          <>
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {filteredSubscriptions.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-8 sm:p-12 text-center">
              <CreditCard className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Activation Modal with Mobile Responsive Design and Proper Scrolling */}
      <Dialog open={isActivationModalOpen} onOpenChange={setIsActivationModalOpen}>
        <DialogContent className="max-w-sm sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Activate Subscription</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 sm:p-4 bg-muted rounded">
                <h3 className="font-medium text-sm sm:text-base">{selectedUser.user_name || "No name"}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedUser.user_email}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs sm:text-sm font-medium">Plan Name</Label>
                  <Select value={activationDetails.planName} onValueChange={handlePlanChange}>
                    <SelectTrigger className="mt-1 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wakti Monthly">Wakti Monthly (60 QAR/month)</SelectItem>
                      <SelectItem value="Wakti Yearly">Wakti Yearly (600 QAR/year)</SelectItem>
                      <SelectItem value="Gift from Admin (1 week free)">Gift from Admin (1 week free)</SelectItem>
                      <SelectItem value="Gift from Admin (1 month free)">Gift from Admin (1 month free)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium">PayPal Subscription ID (REQUIRED)</Label>
                  <Input
                    placeholder="Enter PayPal Subscription ID manually..."
                    value={activationDetails.paypalSubscriptionId}
                    onChange={(e) => setActivationDetails(prev => ({
                      ...prev,
                      paypalSubscriptionId: e.target.value
                    }))}
                    className="mt-1 text-xs sm:text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Copy and paste the PayPal Subscription ID from your PayPal dashboard
                  </p>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm font-medium">Billing Start Date</Label>
                  <Input
                    type="date"
                    value={activationDetails.billingStartDate}
                    onChange={(e) => setActivationDetails(prev => ({
                      ...prev,
                      billingStartDate: e.target.value
                    }))}
                    className="mt-1 text-xs sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm font-medium">Amount</Label>
                    <div className="mt-1 p-2 bg-muted rounded text-xs sm:text-sm">
                      {activationDetails.billingAmount} {activationDetails.billingCurrency}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm font-medium">Cycle</Label>
                    <div className="mt-1 p-2 bg-muted rounded text-xs sm:text-sm capitalize">
                      {activationDetails.billingCycle}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    <span className="text-xs sm:text-sm font-medium text-blue-800">Subscription Details</span>
                  </div>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p><strong>Plan:</strong> {activationDetails.planName}</p>
                    <p><strong>PayPal Plan ID:</strong> {activationDetails.paypalPlanId}</p>
                    <p><strong>Billing Start Date:</strong> {new Date(activationDetails.billingStartDate).toLocaleDateString()}</p>
                    <p><strong>PayPal Subscription ID:</strong> {activationDetails.paypalSubscriptionId || 'Enter PayPal ID above'}</p>
                    <p><strong>Next Billing Date:</strong> {
                      (() => {
                        const next = new Date(activationDetails.billingStartDate);
                        if (activationDetails.billingCycle === 'yearly') {
                          next.setFullYear(next.getFullYear() + 1);
                        } else if (activationDetails.planName.includes('1 week')) {
                          next.setDate(next.getDate() + 7);
                        } else {
                          next.setMonth(next.getMonth() + 1);
                        }
                        return next.toLocaleDateString();
                      })()
                    }</p>
                    <p><strong>Note:</strong> PayPal ID will be tied to user's billing tab in their account page.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsActivationModalOpen(false)} className="text-xs sm:text-sm">
                  Cancel
                </Button>
                <Button 
                  onClick={confirmActivateSubscription}
                  disabled={activatingId === selectedUser.user_id || !activationDetails.paypalSubscriptionId.trim()}
                  className="flex items-center justify-center space-x-2 text-xs sm:text-sm"
                >
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
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
