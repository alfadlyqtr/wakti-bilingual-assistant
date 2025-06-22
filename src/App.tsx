
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Maw3d from "@/pages/Maw3d";
import Maw3dCreate from "@/pages/Maw3dCreate";
import Maw3dEdit from "@/pages/Maw3dEdit";
import Maw3dManage from "@/pages/Maw3dManage";
import Maw3dView from "@/pages/Maw3dView";
import Maw3dEvents from "@/pages/Maw3dEvents";
import StandaloneEvent from "@/pages/StandaloneEvent";
import Tasjeel from "@/pages/Tasjeel";
import WaktiAi from "@/pages/WaktiAi";
import Settings from "@/pages/Settings";
import Account from "@/pages/Account";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ResetSuccess from "@/pages/ResetSuccess";
import Confirmed from "@/pages/Confirmed";
import Contacts from "@/pages/Contacts";
import PrivacyTerms from "@/pages/PrivacyTerms";
import ContactUs from "@/pages/ContactUs";
import { PageContainer } from "@/components/PageContainer";
import { MobileNav } from "@/components/MobileNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import TasksReminders from "@/pages/TasksReminders";
import SharedTask from "@/pages/SharedTask";
import Help from "@/pages/Help";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminSettings from "@/pages/AdminSettings";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <div className="min-h-screen bg-background text-foreground">
              <Routes>
                {/* Admin Routes - Completely Separate */}
                <Route path="/mqtr" element={<AdminLogin />} />
                <Route
                  path="/admindash"
                  element={
                    <AdminProtectedRoute>
                      <AdminDashboard />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin-settings"
                  element={
                    <AdminProtectedRoute>
                      <AdminSettings />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminProtectedRoute>
                      <AdminUsers />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/messages"
                  element={
                    <AdminProtectedRoute>
                      <AdminMessages />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/subscriptions"
                  element={
                    <AdminProtectedRoute>
                      <AdminSubscriptions />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/quotas"
                  element={
                    <AdminProtectedRoute>
                      <AdminQuotas />
                    </AdminProtectedRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <AdminProtectedRoute>
                      <AdminAnalytics />
                    </AdminProtectedRoute>
                  }
                />
                
                {/* Public Routes */}
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-success" element={<ResetSuccess />} />
                <Route path="/confirmed" element={<Confirmed />} />
                <Route path="/privacy-terms" element={<PrivacyTerms />} />
                <Route path="/contact" element={<ContactUs />} />
                
                {/* Root Route - Redirect to Home for landing */}
                <Route path="/" element={<Navigate to="/home" replace />} />
                
                {/* Protected Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Dashboard />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Calendar />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maw3d"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3d />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                
                {/* Maw3d Events Routes */}
                <Route
                  path="/maw3d-events"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3dEvents />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maw3d/create"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3dCreate />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maw3d/edit/:id"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3dEdit />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maw3d/manage/:id"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3dManage />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maw3d/view/:id"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3dView />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                
                {/* Public Standalone Event Route */}
                <Route path="/event/:shortId" element={<StandaloneEvent />} />
                
                <Route
                  path="/tasjeel"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Tasjeel />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wakti-ai"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <WaktiAi />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Settings />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Account />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/help"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Help />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contacts"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Contacts />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                
                {/* T&R Routes */}
                <Route 
                  path="/tr" 
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <TasksReminders />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Public Shared Task Route */}
                <Route path="/shared-task/:shareLink" element={<SharedTask />} />
                
                {/* 404 Route - Redirect to Home */}
                <Route path="*" element={<Navigate to="/home" />} />
              </Routes>
              
              <Toaster />
            </div>
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
