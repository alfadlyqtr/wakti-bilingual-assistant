import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { notificationService } from "@/services/notificationService";
import { useEffect } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminGifts from "./pages/AdminGifts";
import AdminSettings from "./pages/AdminSettings";
import Contacts from "./pages/Contacts";
import Tasks from "./pages/Tasks";
import Maw3d from "./pages/Maw3d";
import Settings from "./pages/Settings";
import TR from "./pages/TR";
import CalendarPage from "./pages/CalendarPage";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

const queryClient = new QueryClient();

function App() {
  // Initialize notification service
  useEffect(() => {
    console.log('🚀 App mounted - initializing notification service');
    notificationService.init();

    return () => {
      console.log('🛑 App unmounting - cleaning up notification service');
      notificationService.cleanup();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <GiftNotificationProvider>
            <TooltipProvider>
              <Toaster />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<AppLayout><Home /></AppLayout>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
                  <Route path="/contacts" element={<AppLayout><Contacts /></AppLayout>} />
                  <Route path="/tasks" element={<AppLayout><Tasks /></AppLayout>} />
                  <Route path="/maw3d" element={<AppLayout><Maw3d /></AppLayout>} />
                  <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
                  <Route path="/tr" element={<AppLayout><TR /></AppLayout>} />
                  <Route path="/calendar" element={<AppLayout><CalendarPage /></AppLayout>} />

                  {/* Admin Routes */}
                  <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
                  <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
                  <Route path="/admin/users" element={<AdminProtectedRoute><AdminUsers /></AdminProtectedRoute>} />
                  <Route path="/admin/gifts" element={<AdminProtectedRoute><AdminGifts /></AdminProtectedRoute>} />
                  <Route path="/admin/settings" element={<AdminProtectedRoute><AdminSettings /></AdminProtectedRoute>} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </GiftNotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
