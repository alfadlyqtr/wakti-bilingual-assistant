
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import { AppLayout } from "@/components/AppLayout";
import { notificationService } from "@/services/notificationService";
import { useEffect } from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Contacts from "./pages/Contacts";
import Maw3d from "./pages/Maw3d";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";

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
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/contacts" element={<AppLayout><Contacts /></AppLayout>} />
                  <Route path="/maw3d" element={<AppLayout><Maw3d /></AppLayout>} />
                  <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
                  <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
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
