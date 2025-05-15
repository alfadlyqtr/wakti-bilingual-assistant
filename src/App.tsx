import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
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
            <Toaster />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
