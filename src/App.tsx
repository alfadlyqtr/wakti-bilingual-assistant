import React, { useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster"
import { useTranslation } from "react-i18next";
import i18n from "./utils/i18n";
import { t } from './utils/translations';

import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import WaktiAIV2 from "./pages/WaktiAIV2";
import Maw3dEvents from "./pages/Maw3dEvents";
import Maw3dCreate from "./pages/Maw3dCreate";
import Maw3dEdit from "./pages/Maw3dEdit";
import Maw3dManage from "./pages/Maw3dManage";
import Maw3dView from "./pages/Maw3dView";
import StandaloneEvent from "./pages/StandaloneEvent";
import Contacts from "./pages/Contacts";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

import MyTasks from "@/pages/MyTasks";
import SharedTask from "@/pages/SharedTask";

function App() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const { setLanguage } = useTheme();
  const { i18n } = useTranslation();
	const navigate = useNavigate();

  useEffect(() => {
    const storedLanguage = localStorage.getItem('language');
    if (storedLanguage) {
      i18n.changeLanguage(storedLanguage);
      setLanguage(storedLanguage);
    }
  }, [i18n, setLanguage]);

  useEffect(() => {
    if (location.pathname === '/' && currentUser) {
      navigate('/dashboard');
    }
  }, [location, currentUser, navigate]);

  return (
    <>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/my-tasks" element={
              <ProtectedRoute>
                <MyTasks />
              </ProtectedRoute>
            } />
            
            <Route path="/shared-task/:shortId" element={<SharedTask />} />
            
            <Route path="/calendar" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            
            <Route path="/assistant" element={
              <ProtectedRoute>
                <WaktiAIV2 />
              </ProtectedRoute>
            } />
            
            <Route path="/maw3d" element={
              <ProtectedRoute>
                <Maw3dEvents />
              </ProtectedRoute>
            } />
            
            <Route path="/maw3d/create" element={
              <ProtectedRoute>
                <Maw3dCreate />
              </ProtectedRoute>
            } />
            
            <Route path="/maw3d/edit/:id" element={
              <ProtectedRoute>
                <Maw3dEdit />
              </ProtectedRoute>
            } />
            
            <Route path="/maw3d/manage/:id" element={
              <ProtectedRoute>
                <Maw3dManage />
              </ProtectedRoute>
            } />
            
            <Route path="/maw3d/:shortId" element={<Maw3dView />} />
            <Route path="/event/:shortId" element={<StandaloneEvent />} />
            
            <Route path="/contacts" element={
              <ProtectedRoute>
                <Contacts />
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            
            <Route path="/account" element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
      <Toaster />
    </>
  );
}

export default App;
