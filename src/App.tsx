
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";

// Import all your existing components
import Index from "./pages/Index";
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
import Maw3dEvents from "./pages/Maw3dEvents";
import Tasjeel from "./pages/Tasjeel";
import SharedTask from "./pages/SharedTask";
import ContactUs from "./pages/ContactUs";
import Help from "./pages/Help";
import PrivacyTerms from "./pages/PrivacyTerms";
import Confirmed from "./pages/Confirmed";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminLogin from "./pages/AdminLogin";
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
            <AuthProvider>
              <GiftNotificationProvider>
                <div className="min-h-screen bg-background font-sans antialiased">
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Index />} />
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
                    <Route path="/shared/:shareId" element={<SharedTask />} />
                    
                    {/* Maw3d public view */}
                    <Route path="/maw3d/:shortId" element={<Maw3dView />} />
                    
                    {/* Protected user routes */}
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/tasks-reminders" element={<TasksReminders />} />
                    <Route path="/wakti-ai" element={<WaktiAi />} />
                    <Route path="/wakti-ai-v2" element={<WaktiAIV2 />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/maw3d" element={<Maw3d />} />
                    <Route path="/maw3d/create" element={<Maw3dCreate />} />
                    <Route path="/maw3d/manage" element={<Maw3dManage />} />
                    <Route path="/maw3d/edit/:id" element={<Maw3dEdit />} />
                    <Route path="/maw3d/events" element={<Maw3dEvents />} />
                    <Route path="/tasjeel" element={<Tasjeel />} />
                    
                    {/* Admin routes */}
                    <Route path="/mqtr" element={<AdminLogin />} />
                    <Route path="/admindash" element={
                      <AdminProtectedRoute>
                        <AdminDashboard />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin/users" element={
                      <AdminProtectedRoute>
                        <AdminUsers />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin/messages" element={
                      <AdminProtectedRoute>
                        <AdminMessages />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin/subscriptions" element={
                      <AdminProtectedRoute>
                        <AdminSubscriptions />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin/fawran-payments" element={
                      <AdminProtectedRoute>
                        <AdminFawranPayments />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin/quotas" element={
                      <AdminProtectedRoute>
                        <AdminQuotas />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin/analytics" element={
                      <AdminProtectedRoute>
                        <AdminAnalytics />
                      </AdminProtectedRoute>
                    } />
                    <Route path="/admin-settings" element={
                      <AdminProtectedRoute>
                        <AdminSettings />
                      </AdminProtectedRoute>
                    } />
                    
                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </GiftNotificationProvider>
            </AuthProvider>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
