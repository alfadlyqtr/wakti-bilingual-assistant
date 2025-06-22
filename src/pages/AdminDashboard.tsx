
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, MessageSquare, CreditCard, BarChart3, ChevronDown, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminSession {
  admin_id: string;
  session_token: string;
  expires_at: string;
  email: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    pendingMessages: 0,
    onlineUsers: 0
  });

  useEffect(() => {
    validateAdminSession();
    loadDashboardStats();
  }, []);

  const validateAdminSession = async () => {
    try {
      const storedSession = localStorage.getItem('admin_session');
      
      if (!storedSession) {
        navigate('/mqtr');
        return;
      }

      const session: AdminSession = JSON.parse(storedSession);
      
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        toast.error('Admin session expired');
        navigate('/mqtr');
        return;
      }

      const { data, error } = await supabase.rpc('validate_admin_session', {
        p_session_token: session.session_token
      });

      if (error || !data || data.length === 0) {
        localStorage.removeItem('admin_session');
        toast.error('Invalid admin session');
        navigate('/mqtr');
        return;
      }

      setAdminSession(session);
    } catch (err) {
      console.error('Session validation error:', err);
      localStorage.removeItem('admin_session');
      navigate('/mqtr');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: subCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: messageCount } = await supabase
        .from('contact_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

      const { count: onlineCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_logged_in', true);

      setStats({
        totalUsers: userCount || 0,
        activeSubscriptions: subCount || 0,
        pendingMessages: messageCount || 0,
        onlineUsers: onlineCount || 0
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_session');
    toast.success('Logged out successfully');
    navigate('/mqtr');
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    
    // Navigate to actual pages
    switch (section) {
      case 'users':
        navigate('/admin/users');
        break;
      case 'messages':
        navigate('/admin/messages');
        break;
      case 'subscriptions':
        navigate('/admin/subscriptions');
        break;
      case 'quotas':
        navigate('/admin/quotas');
        break;
      case 'analytics':
        navigate('/admin/analytics');
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      {/* Upper Navigation */}
      <header className="sticky top-0 z-50 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-accent-blue" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">WAKTI Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Welcome, Abdullah Alfadly</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-gradient-secondary hover:bg-gradient-primary"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/admin-settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Admin Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 pb-24">
        {/* Stats Overview - Better organized */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-enhanced-heading mb-6">Dashboard Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-6 w-6 text-accent-blue" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-enhanced-heading">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered users</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                  <CreditCard className="h-6 w-6 text-accent-green" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-enhanced-heading">{stats.activeSubscriptions}</div>
                <p className="text-xs text-muted-foreground mt-1">Paying customers</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Pending Messages</CardTitle>
                  <MessageSquare className="h-6 w-6 text-accent-orange" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-enhanced-heading">{stats.pendingMessages}</div>
                <p className="text-xs text-muted-foreground mt-1">Unread contacts</p>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Online Users</CardTitle>
                  <BarChart3 className="h-6 w-6 text-accent-purple" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-enhanced-heading">{stats.onlineUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently active</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Management Widgets - Better organized */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-enhanced-heading mb-6">Management Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading flex items-center">
                  <Users className="h-5 w-5 mr-2 text-accent-blue" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage app users, view profiles, and control access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full btn-enhanced"
                  onClick={() => handleSectionChange('users')}
                >
                  Manage Users
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-accent-orange" />
                  Support Messages
                </CardTitle>
                <CardDescription>
                  View and respond to user contact forms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full btn-secondary-enhanced"
                  onClick={() => handleSectionChange('messages')}
                >
                  View Messages ({stats.pendingMessages})
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-accent-green" />
                  Subscription Control
                </CardTitle>
                <CardDescription>
                  Manually activate PayPal subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full btn-enhanced"
                  onClick={() => handleSectionChange('subscriptions')}
                >
                  Manage Subscriptions
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-accent-purple" />
                  Quota Management
                </CardTitle>
                <CardDescription>
                  Gift voice credits and translation quotas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full btn-secondary-enhanced"
                  onClick={() => handleSectionChange('quotas')}
                >
                  Manage Quotas
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="text-enhanced-heading flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-accent-cyan" />
                  Analytics Dashboard
                </CardTitle>
                <CardDescription>
                  Revenue tracking and user analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full btn-enhanced"
                  onClick={() => handleSectionChange('analytics')}
                >
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">Recent Activity</CardTitle>
            <CardDescription>Latest admin actions and system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-accent-green rounded-full"></div>
                  <span className="text-sm font-medium">New user registration: user@example.com</span>
                </div>
                <span className="text-xs text-muted-foreground">5 min ago</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-accent-blue rounded-full"></div>
                  <span className="text-sm font-medium">PayPal subscription activated</span>
                </div>
                <span className="text-xs text-muted-foreground">12 min ago</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-accent-orange rounded-full"></div>
                  <span className="text-sm font-medium">New contact form submission</span>
                </div>
                <span className="text-xs text-muted-foreground">1 hour ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation - Centered and Clean */}
      <nav className="fixed bottom-5 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex justify-center py-3 px-6 rounded-full bg-gradient-nav backdrop-blur-xl border border-border/50 shadow-vibrant">
          <div className="flex space-x-2">
            <Button
              variant={activeSection === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveSection('dashboard')}
              className="rounded-full"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Dashboard</span>
            </Button>
            <Button
              variant={activeSection === 'users' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSectionChange('users')}
              className="rounded-full"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Users</span>
            </Button>
            <Button
              variant={activeSection === 'messages' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSectionChange('messages')}
              className="rounded-full relative"
            >
              <MessageSquare className="h-4 w-4" />
              {stats.pendingMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {stats.pendingMessages}
                </span>
              )}
              <span className="hidden sm:inline ml-2">Messages</span>
            </Button>
            <Button
              variant={activeSection === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSectionChange('analytics')}
              className="rounded-full"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Analytics</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}
