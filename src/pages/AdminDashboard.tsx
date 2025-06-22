
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, MessageSquare, CreditCard, BarChart3, Settings, LogOut, Menu, Sun, Moon, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";

interface AdminSession {
  admin_id: string;
  session_token: string;
  expires_at: string;
  email: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme, setTheme, language, setLanguage } = useTheme();
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
    // In a full implementation, you'd navigate to different routes
    toast.info(`Navigating to ${section}`, { duration: 1000 });
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
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full hover:bg-accent/10"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-accent-orange" />
              ) : (
                <Moon className="h-5 w-5 text-accent-purple" />
              )}
            </Button>
            
            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="rounded-full hover:bg-accent/10"
            >
              <Languages className="h-5 w-5 text-accent-green" />
            </Button>
            
            {/* Logout */}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-gradient-secondary hover:bg-gradient-primary"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 pb-24">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-5 w-5 text-accent-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-enhanced-heading">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered app users</p>
            </CardContent>
          </Card>

          <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CreditCard className="h-5 w-5 text-accent-green" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-enhanced-heading">{stats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground mt-1">Paying customers</p>
            </CardContent>
          </Card>

          <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Messages</CardTitle>
              <MessageSquare className="h-5 w-5 text-accent-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-enhanced-heading">{stats.pendingMessages}</div>
              <p className="text-xs text-muted-foreground mt-1">Unread contact forms</p>
            </CardContent>
          </Card>

          <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Users</CardTitle>
              <BarChart3 className="h-5 w-5 text-accent-purple" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-enhanced-heading">{stats.onlineUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently active</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">User Management</CardTitle>
              <CardDescription>
                Manage app users, subscriptions, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full btn-enhanced"
                onClick={() => handleSectionChange('users')}
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
            </CardContent>
          </Card>

          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">Support Messages</CardTitle>
              <CardDescription>
                View and respond to user contact forms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full btn-secondary-enhanced"
                onClick={() => handleSectionChange('messages')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                View Messages ({stats.pendingMessages})
              </Button>
            </CardContent>
          </Card>

          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">Subscription Control</CardTitle>
              <CardDescription>
                Manually activate PayPal subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full btn-enhanced"
                onClick={() => handleSectionChange('subscriptions')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Subscriptions
              </Button>
            </CardContent>
          </Card>

          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">Quota Management</CardTitle>
              <CardDescription>
                Gift voice credits and translation quotas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full btn-secondary-enhanced"
                onClick={() => handleSectionChange('quotas')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Manage Quotas
              </Button>
            </CardContent>
          </Card>

          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">Analytics Dashboard</CardTitle>
              <CardDescription>
                Revenue tracking and user analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full btn-enhanced"
                onClick={() => handleSectionChange('analytics')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </CardContent>
          </Card>

          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="text-enhanced-heading">Admin Settings</CardTitle>
              <CardDescription>
                Configure admin settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full btn-secondary-enhanced"
                onClick={() => handleSectionChange('settings')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Admin Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="enhanced-card">
          <CardHeader>
            <CardTitle className="text-enhanced-heading">Recent Activity</CardTitle>
            <CardDescription>Latest admin actions and system events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gradient-secondary/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-accent-green rounded-full"></div>
                  <span className="text-sm">New user registration: user@example.com</span>
                </div>
                <span className="text-xs text-muted-foreground">5 min ago</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gradient-secondary/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full"></div>
                  <span className="text-sm">PayPal subscription activated</span>
                </div>
                <span className="text-xs text-muted-foreground">12 min ago</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gradient-secondary/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-accent-orange rounded-full"></div>
                  <span className="text-sm">New contact form submission</span>
                </div>
                <span className="text-xs text-muted-foreground">1 hour ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lower Navigation */}
      <nav className="floating-nav">
        <Button
          variant={activeSection === 'dashboard' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSectionChange('dashboard')}
          className="flex-1"
        >
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Dashboard</span>
        </Button>
        <Button
          variant={activeSection === 'users' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSectionChange('users')}
          className="flex-1"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Users</span>
        </Button>
        <Button
          variant={activeSection === 'messages' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSectionChange('messages')}
          className="flex-1 relative"
        >
          <MessageSquare className="h-4 w-4" />
          {stats.pendingMessages > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {stats.pendingMessages}
            </span>
          )}
          <span className="hidden sm:inline ml-1">Messages</span>
        </Button>
        <Button
          variant={activeSection === 'settings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSectionChange('settings')}
          className="flex-1"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Settings</span>
        </Button>
      </nav>
    </div>
  );
}
