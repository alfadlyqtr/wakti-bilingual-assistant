
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
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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
            <Route path="/voice-summary" element={<Dashboard />} />
            <Route path="/events" element={<Dashboard />} /> {/* New route */}
            <Route path="/reminders" element={<Dashboard />} /> {/* New route */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/messages" element={<Dashboard />} />
            <Route path="/contacts" element={<Dashboard />} />
            <Route path="/billing" element={<Dashboard />} />
            <Route path="/profile" element={<Dashboard />} />
            
            {/* Fallback routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
