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
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import Contacts from "@/pages/Contacts";
import Account from "@/pages/Account";
import Home from "@/pages/Home";
import WaktiAI from "@/pages/WaktiAI";
import WaktiAIV2 from "@/pages/WaktiAIV2";
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import Tasjeel from "@/components/tasjeel/Tasjeel";
import { PageContainer } from "@/components/PageContainer";
// Maw3d imports
import Maw3dEvents from "@/pages/Maw3dEvents";
import Maw3dCreate from "@/pages/Maw3dCreate";
import Maw3dView from "@/pages/Maw3dView";
import Maw3dEdit from "@/pages/Maw3dEdit";
import Maw3dManage from "@/pages/Maw3dManage";

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

                {/* Public Maw3d event routes - now wrapped with AuthProvider but still publicly accessible */}
                <Route path="/maw3d/:shortId" element={<Maw3dView />} />
                
                {/* Tasjeel route with special layout (no page title or back button) */}
                <Route path="/tasjeel" element={
                  <TasjeelLayout>
                    <Tasjeel />
                  </TasjeelLayout>
                } />

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
                  
                  {/* New combined tasks and reminders route */}
                  <Route path="/tasks-reminders" element={<AppLayout><TasksReminders /></AppLayout>} />
                  
                  {/* WAKTI AI V2.1 route - completely new system */}
                  <Route path="/wakti-ai" element={<AppLayout><WaktiAIV2 /></AppLayout>} />
                  
                  {/* Maw3d system routes - protected */}
                  <Route path="/maw3d" element={<AppLayout><Maw3dEvents /></AppLayout>} />
                  <Route path="/maw3d/create" element={<AppLayout><Maw3dCreate /></AppLayout>} />
                  <Route path="/maw3d/edit/:id" element={<AppLayout><Maw3dEdit /></AppLayout>} />
                  <Route path="/maw3d/manage/:id" element={<AppLayout><Maw3dManage /></AppLayout>} />
                  
                  {/* Other protected routes */}
                  <Route path="/settings" element={<AppLayout><PageContainer title="Settings"><Settings /></PageContainer></AppLayout>} />
                  <Route path="/contacts" element={<AppLayout><PageContainer title="Contacts"><Contacts /></PageContainer></AppLayout>} />
                  <Route path="/account" element={<AppLayout><PageContainer title="Account"><Account /></PageContainer></AppLayout>} />
                </Route>

                {/* Catch all route for 404 */}
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
