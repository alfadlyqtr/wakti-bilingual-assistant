
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, MessageSquare, CreditCard, BarChart3, ChevronDown, LogOut, Settings, Gift, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="h-screen bg-gradient-background text-foreground flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <header className="flex-shrink-0 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-6 py-4 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-accent-blue" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">WAKTI Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Welcome, Abdullah Alfadly</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-gradient-secondary hover:bg-gradient-primary px-4 py-2"
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

      {/* Scrollable Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 pb-32">
          {/* Recent Activity - Moved to Top */}
          <Card className="enhanced-card mb-8">
            <CardHeader>
              <CardTitle className="text-enhanced-heading text-xl">Recent Activity</CardTitle>
              <CardDescription className="text-sm">Latest admin actions and system events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-accent-green rounded-full"></div>
                    <span className="font-medium text-sm">New user registration: user@example.com</span>
                  </div>
                  <span className="text-xs text-muted-foreground">5 min ago</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-accent-blue rounded-full"></div>
                    <span className="font-medium text-sm">PayPal subscription activated</span>
                  </div>
                  <span className="text-xs text-muted-foreground">12 min ago</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-secondary/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-accent-orange rounded-full"></div>
                    <span className="font-medium text-sm">New contact form submission</span>
                  </div>
                  <span className="text-xs text-muted-foreground">1 hour ago</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Overview - 2x2 Layout */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-enhanced-heading mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-2 gap-6">
              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Total Users</CardTitle>
                    <Users className="h-6 w-6 text-accent-blue" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-enhanced-heading mb-1">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">Registered users</p>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Active Subscriptions</CardTitle>
                    <CreditCard className="h-6 w-6 text-accent-green" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-enhanced-heading mb-1">{stats.activeSubscriptions}</div>
                  <p className="text-xs text-muted-foreground">Paying customers</p>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Pending Messages</CardTitle>
                    <MessageSquare className="h-6 w-6 text-accent-orange" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-enhanced-heading mb-1">{stats.pendingMessages}</div>
                  <p className="text-xs text-muted-foreground">Unread contacts</p>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">Online Users</CardTitle>
                    <BarChart3 className="h-6 w-6 text-accent-purple" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-enhanced-heading mb-1">{stats.onlineUsers}</div>
                  <p className="text-xs text-muted-foreground">Currently active</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Management Tools - 2 Cards Per Row */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-enhanced-heading mb-6">Management Tools</h2>
            <div className="grid grid-cols-2 gap-6">
              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-base">
                    <Users className="h-5 w-5 mr-2 text-accent-blue" />
                    User Management
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Manage app users, view profiles, and control access
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full btn-enhanced text-sm py-4"
                    onClick={() => handleSectionChange('users')}
                  >
                    Manage Users
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-base">
                    <MessageSquare className="h-5 w-5 mr-2 text-accent-orange" />
                    Support Messages
                  </CardTitle>
                  <CardDescription className="text-sm">
                    View and respond to user contact forms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full btn-secondary-enhanced text-sm py-4 relative"
                    onClick={() => handleSectionChange('messages')}
                  >
                    View Messages
                    {stats.pendingMessages > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {stats.pendingMessages}
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-base">
                    <CreditCard className="h-5 w-5 mr-2 text-accent-green" />
                    Subscription Control
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Manually activate PayPal subscriptions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full btn-enhanced text-sm py-4"
                    onClick={() => handleSectionChange('subscriptions')}
                  >
                    Manage Subscriptions
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-base">
                    <Gift className="h-5 w-5 mr-2 text-accent-purple" />
                    Quota Management
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Gift voice credits and translation quotas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full btn-secondary-enhanced text-sm py-4"
                    onClick={() => handleSectionChange('quotas')}
                  >
                    Manage Quotas
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-base">
                    <BarChart3 className="h-5 w-5 mr-2 text-accent-cyan" />
                    Analytics Dashboard
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Revenue tracking and user analytics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full btn-enhanced text-sm py-4"
                    onClick={() => handleSectionChange('analytics')}
                  >
                    View Analytics
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-base">
                    <UserCheck className="h-5 w-5 mr-2 text-accent-blue" />
                    System Monitoring
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Monitor system health and performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full btn-secondary-enhanced text-sm py-4"
                    onClick={() => toast.info('System monitoring coming soon')}
                  >
                    System Status
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Enhanced Bottom Navigation */}
      <nav className="flex-shrink-0 border-t border-border/30 bg-gradient-nav backdrop-blur-xl shadow-vibrant px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-4 gap-4">
            <Button
              variant={activeSection === 'dashboard' ? 'default' : 'outline'}
              size="lg"
              onClick={() => setActiveSection('dashboard')}
              className={`
                flex flex-col items-center justify-center h-16 w-full rounded-xl transition-all duration-300
                ${activeSection === 'dashboard' 
                  ? 'btn-enhanced shadow-colored scale-105 border-accent-blue/30' 
                  : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'
                }
              `}
            >
              <BarChart3 className={`h-6 w-6 mb-1 ${activeSection === 'dashboard' ? 'text-white' : 'text-accent-blue'}`} />
              <span className="text-xs font-semibold">Dashboard</span>
            </Button>

            <Button
              variant={activeSection === 'users' ? 'default' : 'outline'}
              size="lg"
              onClick={() => handleSectionChange('users')}
              className={`
                flex flex-col items-center justify-center h-16 w-full rounded-xl transition-all duration-300
                ${activeSection === 'users' 
                  ? 'btn-enhanced shadow-colored scale-105 border-accent-green/30' 
                  : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'
                }
              `}
            >
              <Users className={`h-6 w-6 mb-1 ${activeSection === 'users' ? 'text-white' : 'text-accent-green'}`} />
              <span className="text-xs font-semibold">Users</span>
            </Button>

            <Button
              variant={activeSection === 'messages' ? 'default' : 'outline'}
              size="lg"
              onClick={() => handleSectionChange('messages')}
              className={`
                flex flex-col items-center justify-center h-16 w-full rounded-xl transition-all duration-300 relative
                ${activeSection === 'messages' 
                  ? 'btn-enhanced shadow-colored scale-105 border-accent-orange/30' 
                  : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'
                }
              `}
            >
              <MessageSquare className={`h-6 w-6 mb-1 ${activeSection === 'messages' ? 'text-white' : 'text-accent-orange'}`} />
              {stats.pendingMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow-lg">
                  {stats.pendingMessages}
                </span>
              )}
              <span className="text-xs font-semibold">Messages</span>
            </Button>

            <Button
              variant={activeSection === 'analytics' ? 'default' : 'outline'}
              size="lg"
              onClick={() => handleSectionChange('analytics')}
              className={`
                flex flex-col items-center justify-center h-16 w-full rounded-xl transition-all duration-300
                ${activeSection === 'analytics' 
                  ? 'btn-enhanced shadow-colored scale-105 border-accent-purple/30' 
                  : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'
                }
              `}
            >
              <BarChart3 className={`h-6 w-6 mb-1 ${activeSection === 'analytics' ? 'text-white' : 'text-accent-purple'}`} />
              <span className="text-xs font-semibold">Analytics</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}
