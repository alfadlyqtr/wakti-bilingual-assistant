
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

// Import all pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Contacts from "./pages/Contacts";
import Maw3d from "./pages/Maw3d";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import TasksReminders from "./pages/TasksReminders";
import WaktiAi from "./pages/WaktiAi";
import Tasjeel from "./pages/Tasjeel";
import Account from "./pages/Account";
import Help from "./pages/Help";
import PrivacyTerms from "./pages/PrivacyTerms";
import ContactUs from "./pages/ContactUs";
import Maw3dEvents from "./pages/Maw3dEvents";
import Maw3dCreate from "./pages/Maw3dCreate";
import Maw3dEdit from "./pages/Maw3dEdit";
import Maw3dManage from "./pages/Maw3dManage";
import Maw3dView from "./pages/Maw3dView";
import SharedTask from "./pages/SharedTask";
import NotFound from "./pages/NotFound";

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
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/privacy-terms" element={<PrivacyTerms />} />
                  <Route path="/contact" element={<ContactUs />} />
                  <Route path="/help" element={<Help />} />
                  
                  {/* Maw3d public view */}
                  <Route path="/maw3d-view/:shortId" element={<Maw3dView />} />
                  
                  {/* Shared task public view */}
                  <Route path="/shared-task/:shareLink" element={<SharedTask />} />
                  
                  {/* Protected routes with AppLayout */}
                  <Route path="/" element={<AppLayout><Home /></AppLayout>} />
                  <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
                  <Route path="/contacts" element={<AppLayout><Contacts /></AppLayout>} />
                  <Route path="/tasks" element={<AppLayout><TasksReminders /></AppLayout>} />
                  <Route path="/calendar" element={<AppLayout><Calendar /></AppLayout>} />
                  <Route path="/ai" element={<AppLayout><WaktiAi /></AppLayout>} />
                  <Route path="/tasjeel" element={<AppLayout><Tasjeel /></AppLayout>} />
                  <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
                  <Route path="/account" element={<AppLayout><Account /></AppLayout>} />
                  
                  {/* Maw3d routes */}
                  <Route path="/maw3d" element={<AppLayout><Maw3d /></AppLayout>} />
                  <Route path="/maw3d-events" element={<AppLayout><Maw3dEvents /></AppLayout>} />
                  <Route path="/maw3d-create" element={<AppLayout><Maw3dCreate /></AppLayout>} />
                  <Route path="/maw3d-edit/:id" element={<AppLayout><Maw3dEdit /></AppLayout>} />
                  <Route path="/maw3d-manage/:id" element={<AppLayout><Maw3dManage /></AppLayout>} />
                  
                  {/* Catch-all route for 404 */}
                  <Route path="*" element={<NotFound />} />
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
