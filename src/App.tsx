import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminRoute from "@/components/auth/AdminRoute";
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
import SessionEnded from "./pages/SessionEnded";

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
import VoiceTTS from "./pages/VoiceTTS";
import TextGenerator from "./pages/TextGenerator";
import VoiceStudio from "./pages/VoiceStudio";
import GameMode from "./pages/GameMode";

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-background font-sans antialiased">
              <Routes>
                {/* Admin routes */}
                <Route path="/mqtr" element={<AdminLogin />} />
                <Route path="/admin-setup" element={<AdminRoute><AdminSetup /></AdminRoute>} />
                <Route path="/admindash" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />
                <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
                <Route path="/admin/fawran-payments" element={<AdminRoute><AdminFawranPayments /></AdminRoute>} />
                <Route path="/admin/quotas" element={<AdminRoute><AdminQuotas /></AdminRoute>} />
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                <Route path="/admin-settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                
                {/* Public routes - no auth provider needed */}
                <Route path="/" element={<RootHandler />} />
                <Route path="/home" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-success" element={<ResetSuccess />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/help" element={
                  <GiftNotificationProvider>
                    <Help />
                  </GiftNotificationProvider>
                } />
                <Route path="/privacy-terms" element={<PrivacyTerms />} />
                <Route path="/confirmed" element={<Confirmed />} />
                <Route path="/session-ended" element={<SessionEnded />} />
                
                {/* Shared task route (public) */}
                <Route path="/shared-task/:shareLink" element={<SharedTask />} />
                
                {/* Maw3d public view */}
                <Route path="/maw3d/:shortId" element={<Maw3dView />} />
                
                {/* Protected user routes - AuthProvider is mounted once at top level */}
                <Route path="/dashboard" element={
                  <GiftNotificationProvider>
                    <AppLayout><Dashboard /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/account" element={
                  <GiftNotificationProvider>
                    <AppLayout><Account /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/settings" element={
                  <GiftNotificationProvider>
                    <AppLayout><Settings /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tasks-reminders" element={
                  <GiftNotificationProvider>
                    <AppLayout><TasksReminders /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tr" element={
                  <GiftNotificationProvider>
                    <AppLayout><TasksReminders /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/wakti-ai" element={
                  <GiftNotificationProvider>
                    <AppLayout><WaktiAi /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/wakti-ai-v2" element={
                  <GiftNotificationProvider>
                    <AppLayout><WaktiAIV2 /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/calendar" element={
                  <GiftNotificationProvider>
                    <AppLayout><Calendar /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/contacts" element={
                  <GiftNotificationProvider>
                    <AppLayout><Contacts /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3d /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/create" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3dCreate /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/manage/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3dManage /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/edit/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3dEdit /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tasjeel" element={
                  <GiftNotificationProvider>
                    <AppLayout><Tasjeel /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/voice-tts" element={
                  <GiftNotificationProvider>
                    <AppLayout><VoiceTTS /></AppLayout>
                  </GiftNotificationProvider>
                } />
                {/* Tool pages */}
                <Route path="/tools/text" element={
                  <GiftNotificationProvider>
                    <AppLayout><TextGenerator /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/voice-studio" element={
                  <GiftNotificationProvider>
                    <AppLayout><VoiceStudio /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/game" element={
                  <GiftNotificationProvider>
                    <AppLayout><GameMode /></AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* 404 catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            </BrowserRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;