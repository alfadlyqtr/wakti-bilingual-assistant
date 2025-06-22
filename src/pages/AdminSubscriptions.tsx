
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, ArrowLeft, Search, CheckCircle, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
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
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          profiles(email, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const subscriptionsWithUserInfo = data.map(sub => ({
        ...sub,
        user_email: sub.profiles?.email,
        user_name: sub.profiles?.full_name
      }));

      setSubscriptions(subscriptionsWithUserInfo);
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

  const activateSubscription = async (subscriptionId: string) => {
    setActivatingId(subscriptionId);
    
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('id', subscriptionId);

      if (error) throw error;

      setSubscriptions(prev => prev.map(sub => 
        sub.id === subscriptionId ? { ...sub, status: 'active' } : sub
      ));
      
      toast.success('Subscription activated successfully');
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
              onClick={() => navigate('/admindash')}
              className="rounded-full hover:bg-accent/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CreditCard className="h-8 w-8 text-accent-green" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">Subscription Control</h1>
              <p className="text-sm text-muted-foreground">Manually activate PayPal subscriptions</p>
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
              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
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
                {subscriptions.filter(sub => sub.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending Activation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-enhanced-heading">
                {subscriptions.filter(sub => sub.status === 'pending').length}
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
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-enhanced-heading">
                        {subscription.user_name || "No name"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{subscription.user_email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge 
                          variant={subscription.status === 'active' ? "default" : subscription.status === 'pending' ? "secondary" : "outline"}
                          className={
                            subscription.status === 'active' ? 'bg-accent-green' :
                            subscription.status === 'pending' ? 'bg-accent-orange' : ''
                          }
                        >
                          {subscription.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {subscription.amount} {subscription.currency?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Created {new Date(subscription.created_at).toLocaleDateString()}</p>
                      <p className="text-xs">ID: {subscription.id.slice(0, 8)}...</p>
                    </div>
                    
                    {subscription.status === 'pending' && (
                      <Button
                        onClick={() => activateSubscription(subscription.id)}
                        disabled={activatingId === subscription.id}
                        className="btn-enhanced"
                      >
                        {activatingId === subscription.id ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                    )}
                    
                    {subscription.status === 'active' && (
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
              <h3 className="text-lg font-medium text-enhanced-heading mb-2">No subscriptions found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
