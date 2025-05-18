
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Tasks from "@/pages/Tasks";
import Reminders from "@/pages/Reminders";
import Events from "@/pages/Events";
import VoiceSummary from "@/pages/VoiceSummary";
import VoiceSummaryDetail from "@/pages/VoiceSummaryDetail";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import EventCreate from "@/pages/EventCreate";
import EventDetail from "@/pages/EventDetail";
import Messages from "@/pages/Messages";
import Contacts from "@/pages/Contacts";
import Account from "@/pages/Account";
import Home from "@/pages/Home";
import { AIAssistant as AIAssistantInner } from "@/components/ai-assistant/AIAssistant";
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import AuthDebugger from "@/components/AuthDebugger";

// Layout component that adds header and mobile navigation
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-container">
      <AppHeader />
      {children}
      <MobileNav />
      <Toaster />
      {process.env.NODE_ENV !== 'production' && <AuthDebugger />}
    </div>
  );
}

// Create a proper WAKTI AI page that uses the AppLayout
function WaktiAIPage() {
  return (
    <div className="flex-1 overflow-hidden relative">
      <AIAssistantInner />
    </div>
  );
}

function App() {
  console.log("App: Initializing application");
  
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* WAKTI AI route - now using AppLayout */}
              <Route path="/wakti-ai" element={
                <AppLayout>
                  <WaktiAIPage />
                </AppLayout>
              } />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
                <Route path="/tasks" element={<AppLayout><Tasks /></AppLayout>} />
                <Route path="/reminders" element={<AppLayout><Reminders /></AppLayout>} />
                <Route path="/events" element={<AppLayout><Events /></AppLayout>} />
                <Route path="/voice-summary" element={<AppLayout><VoiceSummary /></AppLayout>} />
                <Route path="/voice-summary/:id" element={<AppLayout><VoiceSummaryDetail /></AppLayout>} />
                <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
                <Route path="/event/create" element={<AppLayout><EventCreate /></AppLayout>} />
                <Route path="/event/:id" element={<AppLayout><EventDetail /></AppLayout>} />
                <Route path="/messages" element={<AppLayout><Messages /></AppLayout>} />
                <Route path="/contacts" element={<AppLayout><Contacts /></AppLayout>} />
                <Route path="/account" element={<AppLayout><Account /></AppLayout>} />
              </Route>

              {/* 404 route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
