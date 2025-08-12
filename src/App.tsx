
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

// Import all your existing components
import Index from "./pages/Index";
import RootHandler from "@/components/RootHandler";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ResetSuccess from "./pages/ResetSuccess";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import TasksReminders from "./pages/TasksReminders";
import WaktiAi from "./pages/WaktiAi";
import WaktiAIV2 from "./pages/WaktiAIV2";
import Calendar from "./pages/Calendar";
import Contacts from "./pages/Contacts";
import Maw3d from "./pages/Maw3d";
import Maw3dCreate from "./pages/Maw3dCreate";
import Maw3dManage from "./pages/Maw3dManage";
import Maw3dView from "./pages/Maw3dView";
import Maw3dEdit from "./pages/Maw3dEdit";
import Tasjeel from "./pages/Tasjeel";
import SharedTask from "./pages/SharedTask";
import ContactUs from "./pages/ContactUs";
import Help from "./pages/Help";
import PrivacyTerms from "./pages/PrivacyTerms";
import Confirmed from "./pages/Confirmed";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminLogin from "./pages/AdminLogin";
import AdminSetup from "./pages/AdminSetup";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminMessages from "./pages/AdminMessages";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminQuotas from "./pages/AdminQuotas";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminSettings from "./pages/AdminSettings";
import AdminFawranPayments from "./pages/AdminFawranPayments";

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-background font-sans antialiased">
              <Routes>
                {/* Admin routes - completely isolated from regular auth */}
                <Route path="/mqtr" element={
                  <AdminAuthProvider>
                    <AdminLogin />
                  </AdminAuthProvider>
                } />
                <Route path="/admin-setup" element={
                  <AdminAuthProvider>
                    <AdminSetup />
                  </AdminAuthProvider>
                } />
                <Route path="/admindash" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminDashboard />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin/users" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminUsers />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin/messages" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminMessages />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin/subscriptions" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminSubscriptions />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin/fawran-payments" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminFawranPayments />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin/quotas" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminQuotas />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin/analytics" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminAnalytics />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                <Route path="/admin-settings" element={
                  <AdminAuthProvider>
                    <AdminProtectedRoute>
                      <AdminSettings />
                    </AdminProtectedRoute>
                  </AdminAuthProvider>
                } />
                
                {/* All other routes wrapped with regular AuthProvider */}
                <Route path="/*" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <Routes>
                        {/* Public routes */}
                        <Route path="/" element={<RootHandler />} />
                        <Route path="/home" element={<Index />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/reset-success" element={<ResetSuccess />} />
                        <Route path="/contact" element={<ContactUs />} />
                        <Route path="/help" element={<Help />} />
                        <Route path="/privacy-terms" element={<PrivacyTerms />} />
                        <Route path="/confirmed" element={<Confirmed />} />
                        
                        {/* Shared task route (public) - FIXED */}
                        <Route path="/shared-task/:shareLink" element={<SharedTask />} />
                        
                        {/* Maw3d public view */}
                        <Route path="/maw3d/:shortId" element={<Maw3dView />} />
                        
                        {/* Protected user routes wrapped with AppLayout */}
                        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                        <Route path="/account" element={<AppLayout><Account /></AppLayout>} />
                        <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
                        <Route path="/tasks-reminders" element={<AppLayout><TasksReminders /></AppLayout>} />
                        <Route path="/tr" element={<AppLayout><TasksReminders /></AppLayout>} />
                        <Route path="/wakti-ai" element={<AppLayout><WaktiAi /></AppLayout>} />
                        <Route path="/wakti-ai-v2" element={<AppLayout><WaktiAIV2 /></AppLayout>} />
                        <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
                        <Route path="/contacts" element={<AppLayout><Contacts /></AppLayout>} />
                        {/* Unified Maw3d route - removed redundant /maw3d/events */}
                        <Route path="/maw3d" element={<AppLayout><Maw3d /></AppLayout>} />
                        <Route path="/maw3d/create" element={<AppLayout><Maw3dCreate /></AppLayout>} />
                        <Route path="/maw3d/manage/:id" element={<AppLayout><Maw3dManage /></AppLayout>} />
                        <Route path="/maw3d/edit/:id" element={<AppLayout><Maw3dEdit /></AppLayout>} />
                        <Route path="/tasjeel" element={<AppLayout><Tasjeel /></AppLayout>} />
                        
                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
              </Routes>
            </div>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
