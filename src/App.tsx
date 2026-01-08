import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminRoute from "@/components/auth/AdminRoute";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import { AppLayout } from "@/components/AppLayout";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppStoreBanner } from "@/components/AppStoreBanner";

// Subdomain detection helper
function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  // Handle localhost/dev environments
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  // Split hostname into parts
  const parts = hostname.split('.');
  
  // Check for wakti.ai domain (e.g., mozi.wakti.ai)
  if (parts.length >= 3 && parts[parts.length - 2] === 'wakti' && parts[parts.length - 1] === 'ai') {
    const subdomain = parts.slice(0, -2).join('.');
    // Exclude reserved subdomains
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  // Check for wakti.qa domain (e.g., mozi.wakti.qa)
  if (parts.length >= 3 && parts[parts.length - 2] === 'wakti' && parts[parts.length - 1] === 'qa') {
    const subdomain = parts.slice(0, -2).join('.');
    // Exclude reserved subdomains
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  return null;
}

// Import all your existing components
import Index from "./pages/Index";
import RootHandler from "@/components/RootHandler";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ResetSuccess from "./pages/ResetSuccess";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import TasksReminders from "./pages/TasksReminders";
import WaktiAi from "./pages/WaktiAi";
import WaktiAIV2 from "./pages/WaktiAIV2";
import Calendar from "./pages/Calendar";
import Contacts from "./pages/Contacts";
import ChatPage from "./pages/ChatPage";
import Maw3d from "./pages/Maw3d";
import Maw3dCreate from "./pages/Maw3dCreate";
import Maw3dManage from "./pages/Maw3dManage";
import Maw3dView from "./pages/Maw3dView";
import Maw3dEdit from "./pages/Maw3dEdit";
import Tasjeel from "./pages/Tasjeel";
import SharedTask from "./pages/SharedTask";
import ContactUs from "./pages/ContactUs";
import Help from "./pages/Help";
import PrivacyTerms from "./pages/PrivacyTerms";
import AccountDelete from "./pages/AccountDelete";
import GoodbyeScreen from "./pages/GoodbyeScreen";
import Confirmed from "./pages/Confirmed";
import AuthConfirm from "./pages/AuthConfirm";
import NotFound from "./pages/NotFound";
import SessionEnded from "./pages/SessionEnded";

// Admin pages
import AdminLogin from "./pages/AdminLogin";
import AdminSetup from "./pages/AdminSetup";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminMessages from "./pages/AdminMessages";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminQuotas from "./pages/AdminQuotas";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminSettings from "./pages/AdminSettings";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminAIUsage from "./pages/AdminAIUsage";
import VoiceTTS from "./pages/VoiceTTS";
import VoiceStudio from "./pages/VoiceStudio";
import TextGenerator from "./pages/TextGenerator";
import TextTranslationView from "./pages/TextTranslationView";
import GameMode from "./pages/GameMode";
import Games from "./pages/Games";
import FitnessHealth from "./pages/FitnessHealth";
import FitnessWhoopCallback from "./pages/FitnessWhoopCallback";
import Journal from "./pages/Journal";
import MusicStudio from "./pages/MusicStudio";
import MusicShare from "./pages/MusicShare";
import VideoShare from "./pages/VideoShare";
import LettersCreate from "./pages/LettersCreate";
import LettersWaiting from "./pages/LettersWaiting";
import LettersJoin from "./pages/LettersJoin";
import LettersPlay from "./pages/LettersPlay";
import LettersResults from "./pages/LettersResults";
import PresentationSharePlayer from "./pages/PresentationSharePlayer";
import MyWarranty from "./pages/MyWarranty";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectSlugRedirect from "./pages/ProjectSlugRedirect";
import ProjectPreview from "./pages/ProjectPreview";

import "./App.css";

const queryClient = new QueryClient();

// Check for subdomain on app load
const detectedSubdomain = getSubdomain();

function App() {
  // If subdomain detected (e.g., mozi.wakti.ai), render ProjectPreview directly
  if (detectedSubdomain) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ProjectPreview subdomain={detectedSubdomain} />
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  // Normal app routing
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-background font-sans antialiased">
              <Routes>
                {/* Admin routes */}
                <Route path="/mqtr" element={<AdminLogin />} />
                <Route path="/admin-setup" element={<AdminRoute><AdminSetup /></AdminRoute>} />
                <Route path="/admindash" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />
                <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
                <Route path="/admin/quotas" element={<AdminRoute><AdminQuotas /></AdminRoute>} />
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
                <Route path="/admin/audit-log" element={<AdminRoute><AdminAuditLog /></AdminRoute>} />
                <Route path="/admin/ai-usage" element={<AdminRoute><AdminAIUsage /></AdminRoute>} />
                <Route path="/admin-settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                
                {/* Public routes - no auth provider needed */}
                <Route path="/" element={<RootHandler />} />
                <Route path="/home" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reset-success" element={<ResetSuccess />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route path="/help" element={
                  <GiftNotificationProvider>
                    <AppLayout><Help /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/fitness" element={
                  <GiftNotificationProvider>
                    <AppLayout><FitnessHealth /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/fitness/callback" element={
                  <GiftNotificationProvider>
                    <AppLayout><FitnessWhoopCallback /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/whoop/callback" element={
                  <GiftNotificationProvider>
                    <AppLayout><FitnessWhoopCallback /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/privacy-terms" element={<PrivacyTerms />} />
                <Route path="/account-delete" element={<AccountDelete />} />
                <Route path="/goodbye" element={<GoodbyeScreen />} />
                <Route path="/confirmed" element={<Confirmed />} />
                <Route path="/auth/confirm" element={<AuthConfirm />} />
                <Route path="/session-ended" element={<SessionEnded />} />
                
                {/* Shared task route (public) */}
                <Route path="/shared-task/:shareLink" element={<SharedTask />} />

                {/* Public presentation share player */}
                <Route path="/p/:token" element={<PresentationSharePlayer />} />
                
                {/* Maw3d public view */}
                <Route path="/maw3d/:shortId" element={<Maw3dView />} />
                <Route path="/music/share/:id" element={<MusicShare />} />
                <Route path="/video/:id" element={<VideoShare />} />
                
                {/* Protected user routes - AuthProvider is mounted once at top level */}
                <Route path="/dashboard" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><Dashboard /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/account" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><Account /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/settings" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><Settings /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/tasks-reminders" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><TasksReminders /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/tr" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><TasksReminders /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/wakti-ai" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><WaktiAi /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/wakti-ai-v2" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><WaktiAIV2 /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/calendar" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><Calendar /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/journal" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><Journal /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/music" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><MusicStudio /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/create" element={
                  <GiftNotificationProvider>
                    <AppLayout><LettersCreate /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/join" element={
                  <GiftNotificationProvider>
                    <AppLayout><LettersJoin /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/waiting" element={
                  <GiftNotificationProvider>
                    <AppLayout><LettersWaiting /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/play/:code" element={
                  <GiftNotificationProvider>
                    <AppLayout><LettersPlay /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/results/:code" element={
                  <GiftNotificationProvider>
                    <AppLayout><LettersResults /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games" element={
                  <GiftNotificationProvider>
                    <AppLayout><Games /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/contacts" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout><Contacts /></AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/contacts/:contactId" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <ChatPage />
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3d /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/create" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3dCreate /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/manage/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3dManage /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/edit/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout><Maw3dEdit /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tasjeel" element={
                  <GiftNotificationProvider>
                    <AppLayout><Tasjeel /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/voice-tts" element={
                  <GiftNotificationProvider>
                    <AppLayout><VoiceTTS /></AppLayout>
                  </GiftNotificationProvider>
                } />
                {/* Tool pages */}
                <Route path="/tools/text" element={
                  <GiftNotificationProvider>
                    <AppLayout><TextGenerator /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/text/translation/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout><TextTranslationView /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/voice-studio" element={
                  <GiftNotificationProvider>
                    <AppLayout><VoiceStudio /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/voice" element={
                  <GiftNotificationProvider>
                    <AppLayout><VoiceStudio /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/game" element={
                  <GiftNotificationProvider>
                    <AppLayout><GameMode /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/my-warranty" element={
                  <GiftNotificationProvider>
                    <AppLayout><MyWarranty /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/projects" element={
                  <GiftNotificationProvider>
                    <AppLayout><Projects /></AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/projects/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout><ProjectDetail /></AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* Public preview route for published projects (subdomain rewrite target) */}
                <Route path="/preview/:subdomain" element={<ProjectPreview />} />
                
                <Route path="/:slug" element={<ProjectSlugRedirect />} />
                
                {/* 404 catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              {/* App Store / Play Store Banner - shows on all pages for browser users */}
              <AppStoreBanner position="bottom" dismissible={true} />
            </div>
            </BrowserRouter>
          </AuthProvider>
          <Toaster />
          <SpeedInsights />
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;