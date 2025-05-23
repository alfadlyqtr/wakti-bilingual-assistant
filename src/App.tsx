
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Tasks from "@/pages/Tasks";
import Reminders from "@/pages/Reminders";
import TasksReminders from "@/pages/TasksReminders";
import Events from "@/pages/Events";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import EventCreate from "@/pages/EventCreate";
import EventDetail from "@/pages/EventDetail";
import Contacts from "@/pages/Contacts";
import Account from "@/pages/Account";
import Home from "@/pages/Home";
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import Tasjeel from "@/components/tasjeel/Tasjeel";
import { PageContainer } from "@/components/PageContainer";

// Create a client
const queryClient = new QueryClient();

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

// Special layout for Tasjeel without page title and back button
function TasjeelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-container">
      <AppHeader />
      <div className="flex-1 overflow-y-auto pb-24">
        {children}
      </div>
      <MobileNav />
      <Toaster />
    </div>
  );
}

// Create a proper WAKTI AI page that uses the AppLayout
function WaktiAIPage() {
  // Dynamically import AIAssistant to ensure ToastProvider is mounted first
  const AIAssistantInner = React.lazy(() => import('@/components/ai-assistant/AIAssistant').then(module => ({ 
    default: module.AIAssistant 
  })));
  
  return (
    <div className="flex-1 overflow-hidden relative">
      <React.Suspense fallback={<div>Loading AI Assistant...</div>}>
        <AIAssistantInner />
      </React.Suspense>
    </div>
  );
}

function App() {
  console.log("App: Initializing application");
  
  return (
    <QueryClientProvider client={queryClient}>
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

                {/* Public event detail route - accessible without authentication */}
                <Route path="/event/:id" element={<AppLayout><EventDetail /></AppLayout>} />

                {/* WAKTI AI route - now using AppLayout */}
                <Route path="/wakti-ai" element={
                  <AppLayout>
                    <WaktiAIPage />
                  </AppLayout>
                } />
                
                {/* Tasjeel route with special layout (no page title or back button) */}
                <Route path="/tasjeel" element={
                  <TasjeelLayout>
                    <Tasjeel />
                  </TasjeelLayout>
                } />

                {/* Protected routes - but now without redirect */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
                  
                  {/* New combined tasks and reminders route */}
                  <Route path="/tasks-reminders" element={<AppLayout><TasksReminders /></AppLayout>} />
                  
                  {/* Redirect old routes to the new combined page */}
                  <Route path="/tasks" element={<Navigate to="/tasks-reminders" replace />} />
                  <Route path="/reminders" element={<Navigate to="/tasks-reminders" replace />} />
                  
                  <Route path="/events" element={<AppLayout><Events /></AppLayout>} />
                  <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
                  <Route path="/event/create" element={<AppLayout><EventCreate /></AppLayout>} />
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
    </QueryClientProvider>
  );
}

export default App;
