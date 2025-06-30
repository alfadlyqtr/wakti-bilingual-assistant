
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, MessageSquare, CreditCard, BarChart3, ChevronDown, LogOut, Settings, RefreshCw, Menu, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealTimeAdminData } from "@/hooks/useRealTimeAdminData";
import { RealTimeStatsCards } from "@/components/admin/RealTimeStatsCards";
import { RealTimeActivityFeed } from "@/components/admin/RealTimeActivityFeed";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { FawranStatsCards } from "@/components/admin/FawranStatsCards";
import { PaymentMethodDistribution } from "@/components/admin/PaymentMethodDistribution";

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
      case 'fawran':
        navigate('/admin/fawran-payments');
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
      <div className="bg-gradient-background flex items-center justify-center min-h-screen">
        <div className="text-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-background text-foreground flex flex-col">
      {/* Mobile Responsive Header */}
      <header className="bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-3 sm:px-4 lg:px-6 py-3 flex-shrink-0 z-50">
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
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('fawran')} className="justify-start text-xs py-2 relative">
                <Receipt className="h-3 w-3 mr-2" />
                Fawran
                {stats.pendingFawranPayments > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    {stats.pendingFawranPayments}
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleSectionChange('analytics')} className="justify-start text-xs py-2">
                <BarChart3 className="h-3 w-3 mr-2" />
                Analytics
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content with Proper Scrolling */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 pb-20 space-y-4 sm:space-y-6">
        {/* Fawran Security Dashboard - Featured Section */}
        <FawranStatsCards 
          stats={stats.fawranStats}
          autoApprovalRate={stats.autoApprovalRate}
          avgProcessingTime={stats.avgProcessingTime}
          isLoading={dataLoading}
        />

        {/* Payment Method Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <PaymentMethodDistribution 
            distribution={stats.paymentMethodDistribution}
            isLoading={dataLoading}
          />
          
          {/* Real-Time Activity Feed */}
          <RealTimeActivityFeed activities={recentActivity} isLoading={dataLoading} />
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm lg:text-base">
                  <Users className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-accent-blue group-hover:scale-110 transition-transform" />
                  User Management
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Manage app users, profiles, and access control
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs lg:text-sm py-2 lg:py-3" onClick={() => handleSectionChange('users')}>
                  Manage Users
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm lg:text-base">
                  <MessageSquare className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-accent-orange group-hover:scale-110 transition-transform" />
                  Support Messages
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Contact forms, feedback, and abuse reports
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-secondary-enhanced text-xs lg:text-sm py-2 lg:py-3 relative" onClick={() => handleSectionChange('messages')}>
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
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm lg:text-base">
                  <CreditCard className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-accent-green group-hover:scale-110 transition-transform" />
                  Subscription Control
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Manage subscription lifecycle and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs lg:text-sm py-2 lg:py-3" onClick={() => handleSectionChange('subscriptions')}>
                  Manage Subs
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm lg:text-base">
                  <Receipt className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-accent-purple group-hover:scale-110 transition-transform" />
                  Fawran Payments
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  {stats.pendingFawranPayments} pending payment reviews
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs lg:text-sm py-2 lg:py-3 relative" onClick={() => handleSectionChange('fawran')}>
                  Review Payments
                  {stats.pendingFawranPayments > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {stats.pendingFawranPayments}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="enhanced-card hover:shadow-vibrant transition-all duration-300 group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-enhanced-heading flex items-center text-sm lg:text-base">
                  <BarChart3 className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-accent-cyan group-hover:scale-110 transition-transform" />
                  Analytics Dashboard
                </CardTitle>
                <CardDescription className="text-xs lg:text-sm">
                  Revenue: {stats.monthlyRevenue.toFixed(0)} QAR this month
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full btn-enhanced text-xs lg:text-sm py-2 lg:py-3" onClick={() => handleSectionChange('analytics')}>
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
