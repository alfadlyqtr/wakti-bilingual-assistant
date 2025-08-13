
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
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
                {/* Admin routes - completely isolated with their own AdminAuthProvider */}
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
                    <AdminDashboard />
                  </AdminAuthProvider>
                } />
                <Route path="/admin/users" element={
                  <AdminAuthProvider>
                    <AdminUsers />
                  </AdminAuthProvider>
                } />
                <Route path="/admin/messages" element={
                  <AdminAuthProvider>
                    <AdminMessages />
                  </AdminAuthProvider>
                } />
                <Route path="/admin/subscriptions" element={
                  <AdminAuthProvider>
                    <AdminSubscriptions />
                  </AdminAuthProvider>
                } />
                <Route path="/admin/fawran-payments" element={
                  <AdminAuthProvider>
                    <AdminFawranPayments />
                  </AdminAuthProvider>
                } />
                <Route path="/admin/quotas" element={
                  <AdminAuthProvider>
                    <AdminQuotas />
                  </AdminAuthProvider>
                } />
                <Route path="/admin/analytics" element={
                  <AdminAuthProvider>
                    <AdminAnalytics />
                  </AdminAuthProvider>
                } />
                <Route path="/admin-settings" element={
                  <AdminAuthProvider>
                    <AdminSettings />
                  </AdminAuthProvider>
                } />
                
                {/* Public routes - no auth provider needed */}
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
                
                {/* Shared task route (public) */}
                <Route path="/shared-task/:shareLink" element={<SharedTask />} />
                
                {/* Maw3d public view */}
                <Route path="/maw3d/:shortId" element={<Maw3dView />} />
                
                {/* Protected user routes - wrapped with AuthProvider only */}
                <Route path="/dashboard" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Dashboard /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/account" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Account /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/settings" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Settings /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/tasks-reminders" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><TasksReminders /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/tr" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><TasksReminders /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/wakti-ai" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><WaktiAi /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/wakti-ai-v2" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><WaktiAIV2 /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/calendar" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Calendar /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/contacts" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Contacts /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/maw3d" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Maw3d /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/maw3d/create" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Maw3dCreate /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/maw3d/manage/:id" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Maw3dManage /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/maw3d/edit/:id" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Maw3dEdit /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                <Route path="/tasjeel" element={
                  <AuthProvider>
                    <GiftNotificationProvider>
                      <AppLayout><Tasjeel /></AppLayout>
                    </GiftNotificationProvider>
                  </AuthProvider>
                } />
                
                {/* 404 catch-all */}
                <Route path="*" element={<NotFound />} />
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
