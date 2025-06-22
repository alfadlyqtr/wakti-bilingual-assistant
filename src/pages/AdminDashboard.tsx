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
    <div className="min-h-screen bg-gradient-background text-foreground">
      {/* Mobile Responsive Header */}
      <header className="bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-3 sm:px-4 lg:px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-accent-blue" />
            <div>
              <h1 className="text-xs sm:text-sm lg:text-base font-bold text-enhanced-heading">WAKTI Admin</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Abdullah Alfadly</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} className="bg-gradient-secondary hover:bg-gradient-primary text-xs px-2 sm:px-3 py-1 sm:py-2">
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            
            {/* Mobile Menu Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden px-2 py-1"
            >
              <Menu className="h-3 w-3" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-gradient-secondary hover:bg-gradient-primary text-xs px-2 sm:px-3 py-1 sm:py-2">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Settings</span>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 sm:w-44">
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
          <div className="sm:hidden mt-3 pb-3 border-t border-border/30 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('users')} className="justify-start text-xs py-2">
                <Users className="h-3 w-3 mr-2" />
                Users
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('messages')} className="justify-start text-xs py-2">
                <MessageSquare className="h-3 w-3 mr-2" />
                Messages
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('subscriptions')} className="justify-start text-xs py-2">
                <CreditCard className="h-3 w-3 mr-2" />
                Subscriptions
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('analytics')} className="justify-start text-xs py-2">
                <BarChart3 className="h-3 w-3 mr-2" />
                Analytics
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content - No ScrollArea for Natural Scrolling */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 space-y-4 sm:space-y-6">
        {/* Real-Time Activity Feed */}
        <RealTimeActivityFeed activities={recentActivity} isLoading={dataLoading} />

        {/* Real-Time Dashboard Stats */}
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-sm sm:text-base lg:text-lg font-bold text-enhanced-heading">Live Dashboard</h2>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-accent-green rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
          <RealTimeStatsCards stats={stats} isLoading={dataLoading} />
        </div>

        {/* Management Tools - Improved Layout */}
        <div>
          <h2 className="text-sm sm:text-base lg:text-lg font-bold text-enhanced-heading mb-3 sm:mb-4">Management Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-blue group-hover:scale-110 transition-transform" />
                  User Management
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Manage app users, profiles, and access control
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs sm:text-sm py-2 sm:py-3" onClick={() => handleSectionChange('users')}>
                  Manage Users
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-orange group-hover:scale-110 transition-transform" />
                  Support Messages
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Contact forms, feedback, and abuse reports
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-secondary-enhanced text-xs sm:text-sm py-2 sm:py-3 relative" onClick={() => handleSectionChange('messages')}>
                  View Messages
                  {stats.pendingMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {stats.pendingMessages}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-green group-hover:scale-110 transition-transform" />
                  Subscription Control
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Manage subscription lifecycle and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs sm:text-sm py-2 sm:py-3" onClick={() => handleSectionChange('subscriptions')}>
                  Manage Subs
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-cyan group-hover:scale-110 transition-transform" />
                  Analytics Dashboard
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Revenue: {stats.monthlyRevenue.toFixed(0)} QAR this month
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs sm:text-sm py-2 sm:py-3" onClick={() => handleSectionChange('analytics')}>
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border/30 bg-gradient-nav backdrop-blur-xl shadow-vibrant px-2 sm:px-3 py-2 sm:py-3 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-4 gap-1 sm:gap-2">
            <Button 
              variant={activeSection === 'dashboard' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setActiveSection('dashboard')} 
              className={`
                flex flex-col items-center justify-center h-10 sm:h-12 lg:h-14 w-full rounded-lg transition-all duration-300
                ${activeSection === 'dashboard' ? 'btn-enhanced shadow-colored scale-105 border-accent-blue/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <BarChart3 className={`h-3 w-3 sm:h-4 sm:w-4 mb-0.5 ${activeSection === 'dashboard' ? 'text-white' : 'text-accent-blue'}`} />
              <span className="text-xs font-semibold">Dashboard</span>
            </Button>

            <Button 
              variant={activeSection === 'users' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleSectionChange('users')} 
              className={`
                flex flex-col items-center justify-center h-10 sm:h-12 lg:h-14 w-full rounded-lg transition-all duration-300 relative
                ${activeSection === 'users' ? 'btn-enhanced shadow-colored scale-105 border-accent-green/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <Users className={`h-3 w-3 sm:h-4 sm:w-4 mb-0.5 ${activeSection === 'users' ? 'text-white' : 'text-accent-green'}`} />
              {stats.onlineUsers > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent-green text-white text-xs rounded-full h-3 w-3 sm:h-4 sm:w-4 flex items-center justify-center font-bold shadow-lg">
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
                flex flex-col items-center justify-center h-10 sm:h-12 lg:h-14 w-full rounded-lg transition-all duration-300 relative
                ${activeSection === 'messages' ? 'btn-enhanced shadow-colored scale-105 border-accent-orange/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <MessageSquare className={`h-3 w-3 sm:h-4 sm:w-4 mb-0.5 ${activeSection === 'messages' ? 'text-white' : 'text-accent-orange'}`} />
              {stats.pendingMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full h-3 w-3 sm:h-4 sm:w-4 flex items-center justify-center font-bold shadow-lg animate-pulse">
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
                flex flex-col items-center justify-center h-10 sm:h-12 lg:h-14 w-full rounded-lg transition-all duration-300
                ${activeSection === 'analytics' ? 'btn-enhanced shadow-colored scale-105 border-accent-purple/30' : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'}
              `}
            >
              <BarChart3 className={`h-3 w-3 sm:h-4 sm:w-4 mb-0.5 ${activeSection === 'analytics' ? 'text-white' : 'text-accent-purple'}`} />
              <span className="text-xs font-semibold">Analytics</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}
