
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Tasks from "@/pages/Tasks";
import Reminders from "@/pages/Reminders";
import AIAssistant from "@/pages/AIAssistant";
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

// Enhanced route tracker component to debug navigation
function RouteTracker() {
  const location = useLocation();
  const prevPathRef = React.useRef<string | null>(null);
  
  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = location.pathname;
    
    console.log("App: Navigation occurred", { 
      to: location.pathname,
      from: prevPath,
      state: location.state,
      search: location.search
    });
    
    return () => {
      console.log("App: Component unmounting at path:", location.pathname);
    };
  }, [location]);
  
  return null;
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

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/assistant" element={<AIAssistant />} />
                <Route path="/voice-summary" element={<VoiceSummary />} />
                <Route path="/voice-summary/:id" element={<VoiceSummaryDetail />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/event/create" element={<EventCreate />} />
                <Route path="/event/:id" element={<EventDetail />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/account" element={<Account />} />
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
