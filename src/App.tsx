import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminRoute from "@/components/auth/AdminRoute";
import { DebugContextProvider } from "@/hooks/useDebugContext";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import { AppLayout } from "@/components/AppLayout";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppStoreBanner } from "@/components/AppStoreBanner";
import { optimizedQueryClient } from "@/config/queryConfig";
import { 
  SuspensePage,
  MinimalLoader, 
  DashboardLoader, 
  AICoderLoader,
  CalendarLoader,
  ChatLoader,
  AdminLoader 
} from "@/utils/lazyPages";

// ============================================================================
// LAZY LOADED PAGES - Code Splitting for optimal initial bundle size
// ============================================================================

// Public Pages
const Index = lazy(() => import("./pages/Index"));
const RootHandler = lazy(() => import("@/components/RootHandler"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ResetSuccess = lazy(() => import("./pages/ResetSuccess"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Help = lazy(() => import("./pages/Help"));
const PrivacyTerms = lazy(() => import("./pages/PrivacyTerms"));
const AccountDelete = lazy(() => import("./pages/AccountDelete"));
const GoodbyeScreen = lazy(() => import("./pages/GoodbyeScreen"));
const Confirmed = lazy(() => import("./pages/Confirmed"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SessionEnded = lazy(() => import("./pages/SessionEnded"));
const SharedTask = lazy(() => import("./pages/SharedTask"));
const PresentationSharePlayer = lazy(() => import("./pages/PresentationSharePlayer"));
const MusicShare = lazy(() => import("./pages/MusicShare"));
const VideoShare = lazy(() => import("./pages/VideoShare"));

// Protected User Pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Account = lazy(() => import("./pages/Account"));
const Settings = lazy(() => import("./pages/Settings"));
const TasksReminders = lazy(() => import("./pages/TasksReminders"));
const WaktiAi = lazy(() => import("./pages/WaktiAi"));
const WaktiAIV2 = lazy(() => import("./pages/WaktiAIV2"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const Maw3d = lazy(() => import("./pages/Maw3d"));
const Maw3dCreate = lazy(() => import("./pages/Maw3dCreate"));
const Maw3dManage = lazy(() => import("./pages/Maw3dManage"));
const Maw3dView = lazy(() => import("./pages/Maw3dView"));
const Maw3dEdit = lazy(() => import("./pages/Maw3dEdit"));
const Tasjeel = lazy(() => import("./pages/Tasjeel"));
const VoiceTTS = lazy(() => import("./pages/VoiceTTS"));
const VoiceStudio = lazy(() => import("./pages/VoiceStudio"));
const TextGenerator = lazy(() => import("./pages/TextGenerator"));
const TextTranslationView = lazy(() => import("./pages/TextTranslationView"));
const GameMode = lazy(() => import("./pages/GameMode"));
const Games = lazy(() => import("./pages/Games"));
const FitnessHealth = lazy(() => import("./pages/FitnessHealth"));
const FitnessWhoopCallback = lazy(() => import("./pages/FitnessWhoopCallback"));
const Journal = lazy(() => import("./pages/Journal"));
const MusicStudio = lazy(() => import("./pages/MusicStudio"));
const LettersCreate = lazy(() => import("./pages/LettersCreate"));
const LettersWaiting = lazy(() => import("./pages/LettersWaiting"));
const LettersJoin = lazy(() => import("./pages/LettersJoin"));
const LettersPlay = lazy(() => import("./pages/LettersPlay"));
const LettersResults = lazy(() => import("./pages/LettersResults"));
const MyWarranty = lazy(() => import("./pages/MyWarranty"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectSlugRedirect = lazy(() => import("./pages/ProjectSlugRedirect"));
const ProjectPreview = lazy(() => import("./pages/ProjectPreview"));

// Admin Pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminMessages = lazy(() => import("./pages/AdminMessages"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const AdminQuotas = lazy(() => import("./pages/AdminQuotas"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminAIUsage = lazy(() => import("./pages/AdminAIUsage"));

import "./App.css";

// ============================================================================
// SUBDOMAIN DETECTION - For project preview URLs
// ============================================================================

function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  const parts = hostname.split('.');
  
  // Check for wakti.ai domain (e.g., mozi.wakti.ai)
  if (parts.length >= 3 && parts[parts.length - 2] === 'wakti' && parts[parts.length - 1] === 'ai') {
    const subdomain = parts.slice(0, -2).join('.');
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  // Check for wakti.qa domain (e.g., mozi.wakti.qa)
  if (parts.length >= 3 && parts[parts.length - 2] === 'wakti' && parts[parts.length - 1] === 'qa') {
    const subdomain = parts.slice(0, -2).join('.');
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'api') {
      return subdomain;
    }
  }
  
  return null;
}

// Check for subdomain on app load
const detectedSubdomain = getSubdomain();

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  // If subdomain detected (e.g., mozi.wakti.ai), render ProjectPreview directly
  if (detectedSubdomain) {
    return (
      <QueryClientProvider client={optimizedQueryClient}>
        <ThemeProvider>
          <Suspense fallback={<MinimalLoader />}>
            <ProjectPreview subdomain={detectedSubdomain} />
          </Suspense>
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  // Normal app routing with code-split pages
  return (
    <QueryClientProvider client={optimizedQueryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <div className="min-h-screen bg-background font-sans antialiased">
              <Routes>
                {/* ============ ADMIN ROUTES ============ */}
                <Route path="/mqtr" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <AdminLogin />
                  </Suspense>
                } />
                <Route path="/admin-setup" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminSetup />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admindash" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminDashboard />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/users" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminUsers />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/messages" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminMessages />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/subscriptions" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminSubscriptions />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/quotas" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminQuotas />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/analytics" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminAnalytics />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/audit-log" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminAuditLog />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin/ai-usage" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminAIUsage />
                    </Suspense>
                  </AdminRoute>
                } />
                <Route path="/admin-settings" element={
                  <AdminRoute>
                    <Suspense fallback={<AdminLoader />}>
                      <AdminSettings />
                    </Suspense>
                  </AdminRoute>
                } />
                
                {/* ============ PUBLIC ROUTES ============ */}
                <Route path="/" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <RootHandler />
                  </Suspense>
                } />
                <Route path="/home" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <Index />
                  </Suspense>
                } />
                <Route path="/login" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <Login />
                  </Suspense>
                } />
                <Route path="/signup" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <Signup />
                  </Suspense>
                } />
                <Route path="/forgot-password" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ForgotPassword />
                  </Suspense>
                } />
                <Route path="/reset-password" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ResetPassword />
                  </Suspense>
                } />
                <Route path="/reset-success" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ResetSuccess />
                  </Suspense>
                } />
                <Route path="/contact" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ContactUs />
                  </Suspense>
                } />
                <Route path="/help" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <Help />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/fitness" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <FitnessHealth />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/fitness/callback" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <FitnessWhoopCallback />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/whoop/callback" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <FitnessWhoopCallback />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/privacy-terms" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <PrivacyTerms />
                  </Suspense>
                } />
                <Route path="/account-delete" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <AccountDelete />
                  </Suspense>
                } />
                <Route path="/goodbye" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <GoodbyeScreen />
                  </Suspense>
                } />
                <Route path="/confirmed" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <Confirmed />
                  </Suspense>
                } />
                <Route path="/auth/confirm" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <AuthConfirm />
                  </Suspense>
                } />
                <Route path="/session-ended" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <SessionEnded />
                  </Suspense>
                } />
                
                {/* Shared/Public content routes */}
                <Route path="/shared-task/:shareLink" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <SharedTask />
                  </Suspense>
                } />
                <Route path="/p/:token" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <PresentationSharePlayer />
                  </Suspense>
                } />
                <Route path="/maw3d/:shortId" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <Maw3dView />
                  </Suspense>
                } />
                <Route path="/music/share/:id" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <MusicShare />
                  </Suspense>
                } />
                <Route path="/video/:id" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <VideoShare />
                  </Suspense>
                } />
                
                {/* ============ PROTECTED USER ROUTES ============ */}
                <Route path="/dashboard" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<DashboardLoader />}>
                          <Dashboard />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/account" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<MinimalLoader />}>
                          <Account />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/settings" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<MinimalLoader />}>
                          <Settings />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/tasks-reminders" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<DashboardLoader />}>
                          <TasksReminders />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/tr" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<DashboardLoader />}>
                          <TasksReminders />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/wakti-ai" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<ChatLoader />}>
                          <WaktiAi />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/wakti-ai-v2" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<ChatLoader />}>
                          <WaktiAIV2 />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/calendar" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<CalendarLoader />}>
                          <Calendar />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/journal" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<DashboardLoader />}>
                          <Journal />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/music" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<MinimalLoader />}>
                          <MusicStudio />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                
                {/* Letters Game Routes */}
                <Route path="/games/letters/create" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <LettersCreate />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/join" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <LettersJoin />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/waiting" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <LettersWaiting />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/play/:code" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <LettersPlay />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games/letters/results/:code" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <LettersResults />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/games" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <Games />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* Contacts & Chat */}
                <Route path="/contacts" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout>
                        <Suspense fallback={<ChatLoader />}>
                          <Contacts />
                        </Suspense>
                      </AppLayout>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                <Route path="/contacts/:contactId" element={
                  <GiftNotificationProvider>
                    <ErrorBoundary>
                      <Suspense fallback={<ChatLoader />}>
                        <ChatPage />
                      </Suspense>
                    </ErrorBoundary>
                  </GiftNotificationProvider>
                } />
                
                {/* Maw3d Routes */}
                <Route path="/maw3d" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<DashboardLoader />}>
                        <Maw3d />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/create" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <Maw3dCreate />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/manage/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <Maw3dManage />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/maw3d/edit/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <Maw3dEdit />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* Recording & Voice */}
                <Route path="/tasjeel" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <Tasjeel />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/voice-tts" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <VoiceTTS />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* Tools */}
                <Route path="/tools/text" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <TextGenerator />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/text/translation/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <TextTranslationView />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/voice-studio" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <VoiceStudio />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/voice" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <VoiceStudio />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/tools/game" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <GameMode />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/my-warranty" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<MinimalLoader />}>
                        <MyWarranty />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* ============ AI CODER / PROJECTS ============ */}
                <Route path="/projects" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <Suspense fallback={<DashboardLoader />}>
                        <Projects />
                      </Suspense>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                <Route path="/projects/:id" element={
                  <GiftNotificationProvider>
                    <AppLayout>
                      <DebugContextProvider>
                        <Suspense fallback={<AICoderLoader />}>
                          <ProjectDetail />
                        </Suspense>
                      </DebugContextProvider>
                    </AppLayout>
                  </GiftNotificationProvider>
                } />
                
                {/* Public preview route for published projects */}
                <Route path="/preview/:subdomain" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ProjectPreview />
                  </Suspense>
                } />
                
                <Route path="/:slug" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <ProjectSlugRedirect />
                  </Suspense>
                } />
                
                {/* 404 catch-all */}
                <Route path="*" element={
                  <Suspense fallback={<MinimalLoader />}>
                    <NotFound />
                  </Suspense>
                } />
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
