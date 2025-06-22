
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, ArrowLeft, Search, CheckCircle, Clock, User, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useEffect(() => {
    filterSubscriptions();
  }, [subscriptions, searchTerm]);

  const loadSubscriptions = async () => {
    try {
      // Load all users with subscription information from profiles table
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

  const activateSubscription = async (userId: string) => {
    setActivatingId(userId);
    
    try {
      const { error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: userId,
        p_plan_name: 'Monthly',
        p_billing_amount: 60,
        p_billing_currency: 'QAR'
      });

      if (error) {
        console.error('Error activating subscription:', error);
        throw error;
      }

      setSubscriptions(prev => prev.map(sub => 
        sub.user_id === userId ? { 
          ...sub, 
          status: 'active',
          is_subscribed: true,
          subscription_status: 'active'
        } : sub
      ));
      
      toast.success('Subscription activated successfully');
      loadSubscriptions(); // Refresh data
    } catch (err) {
      console.error('Error activating subscription:', err);
      toast.error('Failed to activate subscription');
    } finally {
      setActivatingId(null);
    }
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
                      <p>Joined {new Date(subscription.created_at).toLocaleDateString()}</p>
                      <p className="text-xs">ID: {subscription.id.slice(0, 8)}...</p>
                    </div>
                    
                    {(!subscription.is_subscribed || subscription.subscription_status !== 'active') && (
                      <Button
                        onClick={() => activateSubscription(subscription.user_id)}
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
    </div>
  );
}
