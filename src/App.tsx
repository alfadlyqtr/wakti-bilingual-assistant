import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/providers/ThemeProvider';
import Index from '@/pages/Index';
import Home from '@/pages/Home';
import Tasks from '@/pages/Tasks';
import Events from '@/pages/Events';
import Calendar from '@/pages/Calendar';
import Settings from '@/pages/Settings';
import Profile from '@/pages/Profile';
import Account from '@/pages/Account';
import Contacts from '@/pages/Contacts';
import Reminders from '@/pages/Reminders';
import ActivityMonitor from '@/pages/ActivityMonitor';
import Auth from '@/pages/Auth';
import ContactForm from '@/components/ContactForm';
import { Tasjeel } from '@/components/tasjeel/Tasjeel';
import { VoiceClone } from '@/components/voice-clone/VoiceClone';
import { TextToSpeech } from '@/components/text-to-speech/TextToSpeech';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import AdminLogin from '@/pages/AdminLogin';
import AdminDashboard from '@/pages/AdminDashboard';

const queryClient = new QueryClient();

function App() {
  return (
    <div className="App">
      <AdminAuthProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <div className="min-h-screen bg-background text-foreground">
                <Toaster />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/tasks" element={<Tasks />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/reminders" element={<Reminders />} />
                  <Route path="/activity-monitor" element={<ActivityMonitor />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/contact-form" element={<ContactForm />} />
                  <Route path="/tasjeel" element={<Tasjeel />} />
                  <Route path="/voice-clone" element={<VoiceClone />} />
                  <Route path="/text-to-speech" element={<TextToSpeech />} />
                  
                  {/* Admin Routes */}
                  <Route path="/mqtr" element={<AdminLogin />} />
                  <Route path="/admindash" element={<AdminDashboard />} />
                </Routes>
              </div>
            </BrowserRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </AdminAuthProvider>
    </div>
  );
}

export default App;
