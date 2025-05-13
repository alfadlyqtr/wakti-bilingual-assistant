
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./providers/ThemeProvider";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import Events from "./pages/Events";
import EventCreate from "./pages/EventCreate";
import EventDetail from "./pages/EventDetail";
import Contacts from "./pages/Contacts";
import Messages from "./pages/Messages";
import VoiceSummary from "./pages/VoiceSummary";
import VoiceSummaryDetail from "./pages/VoiceSummaryDetail";
import TasksReminders from "./pages/TasksReminders";
import { Toaster } from "./components/ui/toaster";
import "./App.css";

function App() {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Simulate loading (could be auth check, data loading, etc)
    const timer = setTimeout(() => {
      setInitializing(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <img
          src="/lovable-uploads/b2ccfe85-51b7-4b00-af3f-9919d8b5be57.png"
          alt="WAKTI Logo"
          className="w-16 h-16 animate-pulse"
        />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Account />} />
          <Route path="/tasks" element={<TasksReminders />} />
          <Route path="/reminders" element={<Navigate to="/tasks" replace />} />
          <Route path="/events" element={<Events />} />
          <Route path="/event/create" element={<EventCreate />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/voice-summary" element={<VoiceSummary />} />
          <Route path="/voice-summary/:id" element={<VoiceSummaryDetail />} />
          {/* Add a 404 route that also redirects to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        
        <Toaster />
      </Router>
    </ThemeProvider>
  );
}

export default App;
