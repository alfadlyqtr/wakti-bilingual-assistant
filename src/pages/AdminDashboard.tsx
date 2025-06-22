
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, MessageSquare, CreditCard, BarChart3, ChevronDown, LogOut, Settings, Gift, UserCheck, RefreshCw, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealTimeAdminData } from "@/hooks/useRealTimeAdminData";
import { RealTimeStatsCards } from "@/components/admin/RealTimeStatsCards";
import { RealTimeActivityFeed } from "@/components/admin/RealTimeActivityFeed";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const {
    stats,
    recentActivity,
    isLoading: dataLoading,
    refetch
  } = useRealTimeAdminData();

  useEffect(() => {
    validateAdminSession();
  }, []);

  const validateAdminSession = async () => {
    try {
      const storedSession = localStorage.getItem('admin_session');
      if (!storedSession) {
        console.log('No admin session found, redirecting to admin login...');
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

  const handleLogout = () => {
    localStorage.removeItem('admin_session');
    toast.success('Logged out successfully');
    navigate('/mqtr');
  };

  const handleSectionChange = (section: string) => {
    console.log(`Admin Dashboard - navigating to section: ${section}`);
    setActiveSection(section);
    setMobileMenuOpen(false);
    
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

  const handleRefresh = async () => {
    toast.info('Refreshing data...');
    await refetch();
    toast.success('Data refreshed successfully');
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
      {/* Mobile Responsive Header */}
      <header className="flex-shrink-0 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-accent-blue" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-enhanced-heading">WAKTI Admin</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Abdullah Alfadly</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="bg-gradient-secondary hover:bg-gradient-primary hidden sm:flex">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            {/* Mobile Menu Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-gradient-secondary hover:bg-gradient-primary">
                  <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Settings</span>
                  <ChevronDown className="h-4 w-4 ml-1 sm:ml-2" />
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

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden mt-4 pb-4 border-t border-border/30 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('users')} className="justify-start">
                <Users className="h-4 w-4 mr-2" />
                Users
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('messages')} className="justify-start">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('subscriptions')} className="justify-start">
                <CreditCard className="h-4 w-4 mr-2" />
                Subscriptions
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('analytics')} className="justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="w-full mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        )}
      </header>

      {/* Scrollable Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 pb-32">
          {/* Real-Time Activity Feed */}
          <div className="mb-6 sm:mb-8">
            <RealTimeActivityFeed activities={recentActivity} isLoading={dataLoading} />
          </div>

          {/* Real-Time Dashboard Stats - Mobile Responsive */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-enhanced-heading">Live Dashboard</h2>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-accent-green rounded-full animate-pulse"></div>
                <span className="text-xs sm:text-sm text-muted-foreground">Live</span>
              </div>
            </div>
            <RealTimeStatsCards stats={stats} isLoading={dataLoading} />
          </div>

          {/* Management Tools - Mobile Responsive Grid */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-enhanced-heading mb-4 sm:mb-6">Management Tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-blue" />
                    User Management
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Manage app users, profiles, and access control
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full btn-enhanced text-xs sm:text-sm py-3 sm:py-4" onClick={() => handleSectionChange('users')}>
                    Manage Users
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-orange" />
                    Support Messages
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Contact forms, feedback, and abuse reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full btn-secondary-enhanced text-xs sm:text-sm py-3 sm:py-4 relative" onClick={() => handleSectionChange('messages')}>
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
                  <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-green" />
                    Subscription Control
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Manage subscription lifecycle and billing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full btn-enhanced text-xs sm:text-sm py-3 sm:py-4" onClick={() => handleSectionChange('subscriptions')}>
                    Manage Subs
                  </Button>
                </CardContent>
              </Card>

              <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-cyan" />
                    Analytics Dashboard
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Revenue: {stats.monthlyRevenue.toFixed(0)} QAR this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full btn-enhanced text-xs sm:text-sm py-3 sm:py-4" onClick={() => handleSectionChange('analytics')}>
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Mobile Bottom Navigation */}
      <nav className="flex-shrink-0 border-t border-border/30 bg-gradient-nav backdrop-blur-xl shadow-vibrant px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            <Button 
              variant={activeSection === 'dashboard' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveSection('dashboard')} 
              className={`
                flex flex-col items-center justify-center h-12 sm:h-16 w-full rounded-xl transition-all duration-300
                ${activeSection === 'dashboard' ? 'btn-enhanced shadow-colored scale-105 border-accent-blue/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <BarChart3 className={`h-4 w-4 sm:h-6 sm:w-6 mb-1 ${activeSection === 'dashboard' ? 'text-white' : 'text-accent-blue'}`} />
              <span className="text-xs font-semibold">Dashboard</span>
            </Button>

            <Button 
              variant={activeSection === 'users' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleSectionChange('users')} 
              className={`
                flex flex-col items-center justify-center h-12 sm:h-16 w-full rounded-xl transition-all duration-300 relative
                ${activeSection === 'users' ? 'btn-enhanced shadow-colored scale-105 border-accent-green/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <Users className={`h-4 w-4 sm:h-6 sm:w-6 mb-1 ${activeSection === 'users' ? 'text-white' : 'text-accent-green'}`} />
              {stats.onlineUsers > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent-green text-white text-xs rounded-full h-4 w-4 sm:h-6 sm:w-6 flex items-center justify-center font-bold shadow-lg">
                  {stats.onlineUsers}
                </span>
              )}
              <span className="text-xs font-semibold">Users</span>
            </Button>

            <Button 
              variant={activeSection === 'messages' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleSectionChange('messages')} 
              className={`
                flex flex-col items-center justify-center h-12 sm:h-16 w-full rounded-xl transition-all duration-300 relative
                ${activeSection === 'messages' ? 'btn-enhanced shadow-colored scale-105 border-accent-orange/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <MessageSquare className={`h-4 w-4 sm:h-6 sm:w-6 mb-1 ${activeSection === 'messages' ? 'text-white' : 'text-accent-orange'}`} />
              {stats.pendingMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 sm:h-6 sm:w-6 flex items-center justify-center font-bold shadow-lg animate-pulse">
                  {stats.pendingMessages}
                </span>
              )}
              <span className="text-xs font-semibold">Messages</span>
            </Button>

            <Button 
              variant={activeSection === 'analytics' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleSectionChange('analytics')} 
              className={`
                flex flex-col items-center justify-center h-12 sm:h-16 w-full rounded-xl transition-all duration-300
                ${activeSection === 'analytics' ? 'btn-enhanced shadow-colored scale-105 border-accent-purple/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <BarChart3 className={`h-4 w-4 sm:h-6 sm:w-6 mb-1 ${activeSection === 'analytics' ? 'text-white' : 'text-accent-purple'}`} />
              <span className="text-xs font-semibold">Analytics</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}
