
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
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

// Enhanced route tracker component to debug navigation
function RouteTracker() {
  const location = useLocation();
  const prevPathRef = React.useRef<string | null>(null);
  
  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = location.pathname;
    
    console.log("NAVIGATION DEBUG: Route changed", { 
      to: location.pathname,
      from: prevPath,
      state: location.state,
      search: location.search
    });
    
    return () => {
      console.log("NAVIGATION DEBUG: Component unmounting at path:", location.pathname);
    };
  }, [location]);
  
  return null;
}

// Layout component that adds header and mobile navigation
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password', '/home', '/'].includes(location.pathname);
  
  // Don't show header on auth pages
  return (
    <div className="mobile-container">
      {!isAuthPage && <AppHeader />}
      {children}
      <MobileNav />
      <Toaster />
    </div>
  );
}

// Wrapper component to render the inner AIAssistant component directly
function WaktiAIPage() {
  return (
    <div className="mobile-container">
      <AppHeader title="WAKTI AI" />
      <div className="flex-1 overflow-hidden">
        <AIAssistantInner />
      </div>
      <MobileNav />
      <Toaster />
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
            <RouteTracker />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* WAKTI AI route */}
              <Route path="/wakti-ai" element={<WaktiAIPage />} />

              {/* Protected routes - but now without redirect */}
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
