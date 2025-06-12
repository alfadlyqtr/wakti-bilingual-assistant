
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Maw3d from "@/pages/Maw3d";
import Tasjeel from "@/pages/Tasjeel";
import WaktiAi from "@/pages/WaktiAi";
import Settings from "@/pages/Settings";
import Account from "@/pages/Account";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Contacts from "@/pages/Contacts";
import PrivacyTerms from "@/pages/PrivacyTerms";
import ContactUs from "@/pages/ContactUs";
import { PageContainer } from "@/components/PageContainer";
import { MobileNav } from "@/components/MobileNav";
import ProtectedRoute from "@/components/ProtectedRoute";
import TasksReminders from "@/pages/TasksReminders";
import SharedTask from "@/pages/SharedTask";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <div className="min-h-screen bg-background text-foreground">
              <Routes>
                {/* Public Routes */}
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy-terms" element={<PrivacyTerms />} />
                <Route path="/contact" element={<ContactUs />} />
                
                {/* Root Route - Redirect to Home for landing */}
                <Route path="/" element={<Navigate to="/home" replace />} />
                
                {/* Protected Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Dashboard />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Calendar />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/maw3d"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Maw3d />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasjeel"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Tasjeel />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wakti-ai"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <WaktiAi />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Settings />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Account />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contacts"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Contacts />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  }
                />
                
                {/* T&R Routes */}
                <Route 
                  path="/tr" 
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <TasksReminders />
                      </PageContainer>
                      <MobileNav />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Public Shared Task Route */}
                <Route path="/shared-task/:shareLink" element={<SharedTask />} />
                
                {/* 404 Route - Redirect to Home */}
                <Route path="*" element={<Navigate to="/home" />} />
              </Routes>
              
              <Toaster />
            </div>
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
