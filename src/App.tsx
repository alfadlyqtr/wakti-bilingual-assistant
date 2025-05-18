
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/hooks/use-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Tasks from "@/pages/Tasks";
import Reminders from "@/pages/Reminders";
import Events from "@/pages/Events";
import VoiceSummary from "@/pages/VoiceSummary";
import VoiceSummaryDetail from "@/pages/VoiceSummaryDetail";
import Settings from "@/pages/Settings";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/NotFound";
import EventCreate from "@/pages/EventCreate";
import EventDetail from "@/pages/EventDetail";
import Messages from "@/pages/Messages";
import Contacts from "@/pages/Contacts";
import Account from "@/pages/Account";
import Home from "@/pages/Home";
import Login from "@/pages/Login"; 
import Signup from "@/pages/Signup";
import { AIAssistant as AIAssistantInner } from "@/components/ai-assistant/AIAssistant";
import { Toaster } from "@/components/ui/toaster";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Layout component that adds header and mobile navigation
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-container">
      <AppHeader />
      {children}
      <MobileNav />
      <Toaster />
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
  console.log(`[${new Date().toISOString()}] App: Initializing application`);
  
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          {/* The Router must wrap the AuthProvider because the AuthProvider uses navigation */}
          <AuthProvider>
            <Routes>
              {/* Public routes - No auth check */}
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              
              {/* Auth routes - Accessible only when NOT authenticated */}
              <Route 
                path="/login" 
                element={
                  <ProtectedRoute requireAuth={false}>
                    <Login />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/signup" 
                element={
                  <ProtectedRoute requireAuth={false}>
                    <Signup />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/forgot-password" 
                element={
                  <ProtectedRoute requireAuth={false}>
                    <ForgotPassword />
                  </ProtectedRoute>
                } 
              />

              {/* Protected routes - Require authentication */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/wakti-ai" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <WaktiAIPage />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/calendar" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Calendar />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/tasks" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Tasks />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/reminders" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Reminders />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/events" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Events />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/voice-summary" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <VoiceSummary />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/voice-summary/:id" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <VoiceSummaryDetail />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Settings />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/event/create" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <EventCreate />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/event/:id" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <EventDetail />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/messages" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Messages />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/contacts" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Contacts />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/account" 
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AppLayout>
                      <Account />
                    </AppLayout>
                  </ProtectedRoute>
                } 
              />

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
