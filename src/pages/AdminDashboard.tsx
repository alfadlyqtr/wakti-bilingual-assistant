
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, 
  CreditCard, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Shield,
  Activity,
  Gift,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  display_name: string;
  is_subscribed: boolean;
  subscription_status: string;
  created_at: string;
  is_logged_in: boolean;
}

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface UnmappedSubscription {
  id: string;
  paypal_subscription_id: string;
  status: string;
  plan_name: string;
  billing_amount: number;
  created_at: string;
  user_id: string;
}

export default function AdminDashboard() {
  const { adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [unmappedSubs, setUnmappedSubs] = useState<UnmappedSubscription[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminUser) {
      navigate('/mqtr');
      return;
    }
    loadDashboardData();
  }, [adminUser, navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadContacts(),
        loadUnmappedSubscriptions(),
        loadOnlineUsers()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, is_subscribed, subscription_status, created_at, is_logged_in')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading users:', error);
      return;
    }
    setUsers(data || []);
  };

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading contacts:', error);
      return;
    }
    setContacts(data || []);
  };

  const loadUnmappedSubscriptions = async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading subscriptions:', error);
      return;
    }
    setUnmappedSubs(data || []);
  };

  const loadOnlineUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, is_subscribed, subscription_status, created_at, is_logged_in')
      .eq('is_logged_in', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading online users:', error);
      return;
    }
    setOnlineUsers(data || []);
  };

  const handleManualActivation = async (userId: string, planName: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: userId,
        p_plan_name: planName,
        p_billing_amount: planName.toLowerCase().includes('year') ? 600 : 60
      });

      if (error) {
        throw error;
      }

      toast.success('Subscription activated successfully!');
      loadDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error activating subscription:', error);
      toast.error('Failed to activate subscription');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/mqtr');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">WAKTI Admin</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Administrative Control Panel</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{adminUser?.full_name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{adminUser?.role}</p>
              </div>
              <Button variant="outline" onClick={handleLogout} size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Users</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{onlineUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter(u => u.is_subscribed).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contact Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contacts.filter(c => c.status === 'unread').length}</div>
              <p className="text-xs text-muted-foreground">Unread messages</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="online">Online Users</TabsTrigger>
            <TabsTrigger value="quotas">Quotas</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.slice(0, 20).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium">{user.display_name || user.email}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <p className="text-xs text-gray-500">
                            Joined: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.is_logged_in && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Activity className="w-3 h-3 mr-1" />
                            Online
                          </Badge>
                        )}
                        {user.is_subscribed ? (
                          <Badge className="bg-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Subscribed
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <XCircle className="w-3 h-3 mr-1" />
                            Free
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManualActivation(user.id, 'Monthly')}
                          disabled={user.is_subscribed}
                        >
                          <Gift className="w-4 h-4 mr-1" />
                          Activate Sub
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
                <CardDescription>Manage user subscriptions and manual activations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {unmappedSubs.slice(0, 20).map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{sub.plan_name}</p>
                        <p className="text-sm text-gray-600">PayPal ID: {sub.paypal_subscription_id}</p>
                        <p className="text-sm text-gray-600">Amount: {sub.billing_amount} QAR</p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={sub.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'}
                        >
                          {sub.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Messages</CardTitle>
                <CardDescription>View and respond to user contact messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-sm text-gray-600">{contact.email}</p>
                        </div>
                        <Badge 
                          variant={contact.status === 'unread' ? 'default' : 'outline'}
                        >
                          {contact.status}
                        </Badge>
                      </div>
                      <p className="font-medium mb-2">{contact.subject}</p>
                      <p className="text-gray-700 mb-2">{contact.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(contact.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="online" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Currently Online Users</CardTitle>
                <CardDescription>Monitor real-time user activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {onlineUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <p className="font-medium">{user.display_name || user.email}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      {user.is_subscribed && (
                        <Badge className="bg-green-600">Subscribed</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quota Management</CardTitle>
                <CardDescription>Gift quotas and manage user limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Voice Clone Credits</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">Gift voice clone characters to users</p>
                      <Button className="w-full">
                        <Gift className="w-4 h-4 mr-2" />
                        Gift Voice Credits
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Translation Quotas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4">Gift translation quotas to users</p>
                      <Button className="w-full">
                        <Gift className="w-4 h-4 mr-2" />
                        Gift Translation Quota
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
