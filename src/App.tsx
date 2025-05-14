
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, AuthRoute } from "./contexts/AuthContext";
import Loading from "./components/ui/loading";

// Pages
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TasksReminders from "./pages/TasksReminders";
import AIAssistant from "./pages/AIAssistant";
import VoiceSummary from "./pages/VoiceSummary";
import VoiceSummaryDetail from "./pages/VoiceSummaryDetail";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import EventCreate from "./pages/EventCreate";
import Messages from "./pages/Messages";
import Calendar from "./pages/Calendar";
import Contacts from "./pages/Contacts";
import Account from "./pages/Account";
import Index from "./pages/Index";

import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Protected routes that require authentication */}
          <Route path="/dashboard" element={<AuthRoute><Dashboard /></AuthRoute>} />
          <Route path="/tasks" element={<AuthRoute><TasksReminders /></AuthRoute>} />
          <Route path="/assistant" element={<AuthRoute><AIAssistant /></AuthRoute>} />
          <Route path="/voice-summary" element={<AuthRoute><VoiceSummary /></AuthRoute>} />
          <Route path="/voice-summary/:id" element={<AuthRoute><VoiceSummaryDetail /></AuthRoute>} />
          <Route path="/events" element={<AuthRoute><Events /></AuthRoute>} />
          <Route path="/events/:id" element={<AuthRoute><EventDetail /></AuthRoute>} />
          <Route path="/events/create" element={<AuthRoute><EventCreate /></AuthRoute>} />
          <Route path="/messages" element={<AuthRoute><Messages /></AuthRoute>} />
          <Route path="/calendar" element={<AuthRoute><Calendar /></AuthRoute>} />
          <Route path="/contacts" element={<AuthRoute><Contacts /></AuthRoute>} />
          <Route path="/account" element={<AuthRoute><Account /></AuthRoute>} />
          <Route path="/settings" element={<AuthRoute><Settings /></AuthRoute>} />
          
          {/* Redirect routes */}
          <Route path="/index" element={<Index />} />
          
          {/* 404 fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </ThemeProvider>
  );
}

export default App;
