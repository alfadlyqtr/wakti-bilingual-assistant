
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import Index from '@/pages/Index';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ResetSuccess from '@/pages/ResetSuccess';
import Confirmed from '@/pages/Confirmed';
import Calendar from '@/pages/Calendar';
import Settings from '@/pages/Settings';
import Account from '@/pages/Account';
import Contacts from '@/pages/Contacts';
import Tasjeel from '@/pages/Tasjeel';
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
              <AuthProvider>
                <div className="min-h-screen bg-background text-foreground">
                  <Toaster />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/home" element={<Home />} />
                    
                    {/* Authentication Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/reset-success" element={<ResetSuccess />} />
                    <Route path="/confirmed" element={<Confirmed />} />
                    
                    {/* App Routes */}
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/tasjeel" element={<Tasjeel />} />
                    
                    {/* Admin Routes */}
                    <Route path="/mqtr" element={<AdminLogin />} />
                    <Route path="/admindash" element={<AdminDashboard />} />
                  </Routes>
                </div>
              </AuthProvider>
            </BrowserRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </AdminAuthProvider>
    </div>
  );
}

export default App;
