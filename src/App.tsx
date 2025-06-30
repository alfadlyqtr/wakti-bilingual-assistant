
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";

// Pages
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ResetSuccess from "@/pages/ResetSuccess";
import Dashboard from "@/pages/Dashboard";
import TasksReminders from "@/pages/TasksReminders";
import Calendar from "@/pages/Calendar";
import Settings from "@/pages/Settings";
import Account from "@/pages/Account";
import Contacts from "@/pages/Contacts";
import Help from "@/pages/Help";
import ContactUs from "@/pages/ContactUs";
import PrivacyTerms from "@/pages/PrivacyTerms";
import WaktiAi from "@/pages/WaktiAi";
import WaktiAIV2 from "@/pages/WaktiAIV2";
import Tasjeel from "@/pages/Tasjeel";
import Maw3d from "@/pages/Maw3d";
import MobileNav from "@/components/MobileNav";
import NotFound from "@/pages/NotFound";
import Confirmed from "@/pages/Confirmed";
import SharedTask from "@/pages/SharedTask";

// Maw3d pages
import Maw3dEvents from "@/pages/Maw3dEvents";
import Maw3dManage from "@/pages/Maw3dManage";
import Maw3dCreate from "@/pages/Maw3dCreate";
import Maw3dEdit from "@/pages/Maw3dEdit";
import Maw3dView from "@/pages/Maw3dView";

// Admin pages
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminUsers from "@/pages/AdminUsers";
import AdminMessages from "@/pages/AdminMessages";
import AdminSubscriptions from "@/pages/AdminSubscriptions";
import AdminAnalytics from "@/pages/AdminAnalytics";
import AdminQuotas from "@/pages/AdminQuotas";
import AdminSettings from "@/pages/AdminSettings";

// Components
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-background">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-success" element={<ResetSuccess />} />
                <Route path="/confirmed" element={<Confirmed />} />
                <Route path="/help" element={<Help />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/privacy-terms" element={<PrivacyTerms />} />
                
                {/* Shared routes */}
                <Route path="/shared-task/:taskId" element={<SharedTask />} />
                <Route path="/maw3d/view/:eventId" element={<Maw3dView />} />
                
                {/* Protected routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/tasks-reminders" element={<ProtectedRoute><TasksReminders /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
                <Route path="/wakti-ai" element={<ProtectedRoute><WaktiAi /></ProtectedRoute>} />
                <Route path="/wakti-ai-v2" element={<ProtectedRoute><WaktiAIV2 /></ProtectedRoute>} />
                <Route path="/tasjeel" element={<ProtectedRoute><Tasjeel /></ProtectedRoute>} />
                <Route path="/maw3d" element={<ProtectedRoute><Maw3d /></ProtectedRoute>} />
                <Route path="/maw3d/events" element={<ProtectedRoute><Maw3dEvents /></ProtectedRoute>} />
                <Route path="/maw3d/manage" element={<ProtectedRoute><Maw3dManage /></ProtectedRoute>} />
                <Route path="/maw3d/create" element={<ProtectedRoute><Maw3dCreate /></ProtectedRoute>} />
                <Route path="/maw3d/edit/:eventId" element={<ProtectedRoute><Maw3dEdit /></ProtectedRoute>} />
                
                {/* Admin routes */}
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
                <Route path="/admin/users" element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>} />
                <Route path="/admin/messages" element={<AdminProtectedRoute><AdminMessages /></AdminProtectedRoute>} />
                <Route path="/admin/subscriptions" element={<AdminProtectedRoute><AdminSubscriptions /></AdminProtectedRoute>} />
                <Route path="/admin/analytics" element={<AdminProtectedRoute><AdminAnalytics /></AdminProtectedRoute>} />
                <Route path="/admin/quotas" element={<AdminProtectedRoute><AdminQuotas /></AdminProtectedRoute>} />
                <Route path="/admin/settings" element={<AdminProtectedRoute><AdminSettings /></AdminProtectedRoute>} />
                
                {/* 404 route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <MobileNav />
              <Toaster />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
