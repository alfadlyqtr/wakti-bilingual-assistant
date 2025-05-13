
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import Contacts from "./pages/Contacts";
import NotFound from "./pages/NotFound";
import Events from "./pages/Events";
import EventCreate from "./pages/EventCreate";
import EventDetail from "./pages/EventDetail";
import VoiceSummary from "./pages/VoiceSummary";
import VoiceSummaryDetail from "./pages/VoiceSummaryDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected Routes - Will add auth check later */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<Dashboard />} />
            <Route path="/calendar" element={<Dashboard />} />
            <Route path="/assistant" element={<Dashboard />} />
            <Route path="/voice-summary" element={<VoiceSummary />} />
            <Route path="/voice-summary/:id" element={<VoiceSummaryDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/create" element={<EventCreate />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/reminders" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account" element={<Account />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/billing" element={<Dashboard />} />
            <Route path="/profile" element={<Navigate to="/account" replace />} />
            
            {/* Fallback routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
