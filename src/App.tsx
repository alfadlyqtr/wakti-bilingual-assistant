
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
                {/* Core Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <PageContainer>
                        <Dashboard />
                      </PageContainer>
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
                    </ProtectedRoute>
                  } 
                />
                
                {/* Public Shared Task Route */}
                <Route path="/shared-task/:shareId" element={<SharedTask />} />
                
                {/* 404 Route - Redirect to Dashboard */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              
              {/* Mobile Navigation - appears on all protected routes */}
              <MobileNav />
              
              <Toaster />
            </div>
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
