import React, { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AppShellSkeleton } from "@/components/ui/AppShellSkeleton";
import { AppLayout } from "@/components/AppLayout";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import { ImageShareNotificationProvider } from "@/components/notifications/ImageShareNotificationProvider";
import { MusicShareNotificationProvider } from "@/components/notifications/MusicShareNotificationProvider";
import { GameInviteNotificationProvider } from "@/components/notifications/GameInviteNotificationProvider";
import { MessageNotificationProvider } from "@/components/notifications/MessageNotificationProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DebugContextProvider } from "@/hooks/useDebugContext";

// ─── Eager (lightweight, critical path) ───────────────────────────────────────
import RootHandler from "@/components/RootHandler";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import ResetSuccess from "@/pages/ResetSuccess";
import Confirmed from "@/pages/Confirmed";
import AuthConfirm from "@/pages/AuthConfirm";
import NotFound from "@/pages/NotFound";
import SessionEnded from "@/pages/SessionEnded";
import GoodbyeScreen from "@/pages/GoodbyeScreen";
import AccountDelete from "@/pages/AccountDelete";

// ─── Lazy (heavy / not needed at startup) ─────────────────────────────────────
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Account = lazy(() => import("@/pages/Account"));
const Settings = lazy(() => import("@/pages/Settings"));
const TasksReminders = lazy(() => import("@/pages/TasksReminders"));
const WaktiAi = lazy(() => import("@/pages/WaktiAi"));
const WaktiAIV2 = lazy(() => import("@/pages/WaktiAIV2"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const Maw3d = lazy(() => import("@/pages/Maw3d"));
const Maw3dCreate = lazy(() => import("@/pages/Maw3dCreate"));
const Maw3dManage = lazy(() => import("@/pages/Maw3dManage"));
const Maw3dView = lazy(() => import("@/pages/Maw3dView"));
const Maw3dEdit = lazy(() => import("@/pages/Maw3dEdit"));
const SharedTask = lazy(() => import("@/pages/SharedTask"));
const ContactUs = lazy(() => import("@/pages/ContactUs"));
const Help = lazy(() => import("@/pages/Help"));
const PrivacyTerms = lazy(() => import("@/pages/PrivacyTerms"));
const VoiceTTS = lazy(() => import("@/pages/VoiceTTS"));
const VoiceStudio = lazy(() => import("@/pages/VoiceStudio"));
const TextGenerator = lazy(() => import("@/pages/TextGenerator"));
const TextTranslationView = lazy(() => import("@/pages/TextTranslationView"));
const GameMode = lazy(() => import("@/pages/GameMode"));
const Games = lazy(() => import("@/pages/Games"));
const Vitality = lazy(() => import("@/pages/Vitality"));
const FitnessWhoopCallback = lazy(() => import("@/pages/FitnessWhoopCallback"));
const Journal = lazy(() => import("@/pages/Journal"));
const MusicStudio = lazy(() => import("@/pages/MusicStudio"));
const MusicShare = lazy(() => import("@/pages/MusicShare"));
const PosterShare = lazy(() => import("@/pages/PosterShare"));
const ImageShare = lazy(() => import("@/pages/ImageShare"));
const VideoShare = lazy(() => import("@/pages/VideoShare"));
const BusinessCardShare = lazy(() => import("@/pages/BusinessCardShare"));
const WalletPass = lazy(() => import("@/pages/WalletPass"));
const QRTextView = lazy(() => import("@/pages/QRTextView"));
const LettersCreate = lazy(() => import("@/pages/LettersCreate"));
const LettersWaiting = lazy(() => import("@/pages/LettersWaiting"));
const LettersJoin = lazy(() => import("@/pages/LettersJoin"));
const LettersPlay = lazy(() => import("@/pages/LettersPlay"));
const LettersResults = lazy(() => import("@/pages/LettersResults"));
const PresentationSharePlayer = lazy(() => import("@/pages/PresentationSharePlayer"));
const DiagramView = lazy(() => import("@/pages/DiagramView"));
const MyWarranty = lazy(() => import("@/pages/MyWarranty"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const ProjectSlugRedirect = lazy(() => import("@/pages/ProjectSlugRedirect"));
const ProjectPreview = lazy(() => import("@/pages/ProjectPreview"));
const ChatbotPage = lazy(() => import("@/pages/ChatbotPage"));
const InstagramConnectCallback = lazy(() => import("@/pages/InstagramConnectCallback"));
const GoogleAuthCallback = lazy(() => import("@/pages/GoogleAuthCallback"));
const MyWishlists = lazy(() => import("@/pages/MyWishlists"));
const PublicWishlist = lazy(() => import("@/pages/PublicWishlist"));
const ContactGallery = lazy(() => import("@/pages/ContactGallery"));
const WaktiAgent = lazy(() => import("@/pages/WaktiAgent"));
const Deen = lazy(() => import("@/pages/Deen"));
const DeenQuran = lazy(() => import("@/pages/DeenQuran"));
const DeenHadith = lazy(() => import("@/pages/DeenHadith"));
const DeenAsk = lazy(() => import("@/pages/DeenAsk"));
const DeenStudy = lazy(() => import("@/pages/DeenStudy"));
const DeenAzkar = lazy(() => import("@/pages/DeenAzkar"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[30vh]">
      <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// Item #8 Batch A3: minimal prefetch.
// OLD behaviour: prefetched 6 heavy pages (Dashboard, TasksReminders, Calendar,
// Contacts, WaktiAIV2, Tasjeel) 3s after app mount — even for users still on /login.
// On mobile this competed with first paint and burned data for pages the user
// might never open.
//
// NEW behaviour: only prefetch Dashboard (the landing page after login) and only
// when the user is on an auth/public route where navigation to dashboard is
// likely. Everything else loads on-demand when the user actually navigates there.
// Each route component is already wrapped in lazy() so Suspense handles the wait.
function usePrefetchDashboard() {
  const location = useLocation();
  React.useEffect(() => {
    // Only prefetch when user is on a route that typically leads to /dashboard next.
    // On deep routes (e.g. /wakti-ai-v2) the user is already in the app — no need.
    const prefetchRoutes = ['/', '/home', '/login', '/signup', '/confirmed', '/auth/confirm'];
    if (!prefetchRoutes.includes(location.pathname)) return;

    const prefetch = () => { import("@/pages/Dashboard"); };
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(prefetch, { timeout: 6000 })
      : window.setTimeout(prefetch, 4000);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, [location.pathname]);
}

export default function ConsumerRouter() {
  usePrefetchDashboard();
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <Routes>
        {/* ── Public / Auth ─────────────────────────────────────────────── */}
        <Route path="/" element={<RootHandler />} />
        <Route path="/home" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-success" element={<ResetSuccess />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/privacy-terms" element={<PrivacyTerms />} />
        <Route path="/account-delete" element={<AccountDelete />} />
        <Route path="/goodbye" element={<GoodbyeScreen />} />
        <Route path="/confirmed" element={<Confirmed />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/session-ended" element={<SessionEnded />} />

        {/* ── Public share / viewer routes ──────────────────────────────── */}
        <Route path="/shared-task/:shareLink" element={<SharedTask />} />
        <Route path="/p/:token" element={<PresentationSharePlayer />} />
        <Route path="/chat/:token" element={<ChatbotPage />} />
        <Route path="/diagram/view" element={<DiagramView />} />
        <Route path="/diagram/:id" element={<DiagramView />} />
        <Route path="/card/:shareSlug" element={<BusinessCardShare />} />
        <Route path="/maw3d/:shortId" element={<Maw3dView />} />
        <Route path="/music/share/:id" element={<MusicShare />} />
        <Route path="/wishlist/:id" element={<PublicWishlist />} />
        <Route path="/poster/:id" element={<PosterShare />} />
        <Route path="/image/:id" element={<ImageShare />} />
        <Route path="/video/:id" element={<VideoShare />} />
        <Route path="/wallet-pass" element={<WalletPass />} />
        <Route path="/qr/view" element={<QRTextView />} />
        <Route path="/instagram-connect-callback" element={<InstagramConnectCallback />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

        {/* ── Protected app routes ──────────────────────────────────────── */}
        <Route element={
          <GiftNotificationProvider>
            <ImageShareNotificationProvider>
              <MusicShareNotificationProvider>
                <GameInviteNotificationProvider>
                  <MessageNotificationProvider>
                    <ErrorBoundary>
                      <AppLayout />
                    </ErrorBoundary>
                  </MessageNotificationProvider>
                </GameInviteNotificationProvider>
              </MusicShareNotificationProvider>
            </ImageShareNotificationProvider>
          </GiftNotificationProvider>
        }>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/account" element={<Account />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tasks-reminders" element={<TasksReminders />} />
          <Route path="/tr" element={<TasksReminders />} />
          <Route path="/wakti-ai" element={<WaktiAi />} />
          <Route path="/wakti-ai-v2" element={<WaktiAIV2 />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/music" element={<MusicStudio />} />
          <Route path="/games/letters/create" element={<LettersCreate />} />
          <Route path="/games/letters/join" element={<LettersJoin />} />
          <Route path="/games/letters/waiting" element={<LettersWaiting />} />
          <Route path="/games/letters/play/:code" element={<LettersPlay />} />
          <Route path="/games/letters/results/:code" element={<LettersResults />} />
          <Route path="/games" element={<Games />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:contactId" element={<ChatPage />} />
          <Route path="/maw3d" element={<Maw3d />} />
          <Route path="/maw3d/create" element={<Maw3dCreate />} />
          <Route path="/maw3d/manage/:id" element={<Maw3dManage />} />
          <Route path="/maw3d/edit/:id" element={<Maw3dEdit />} />
          <Route path="/tasjeel" element={<Navigate to="/tools/voice-studio?tab=tasjeel" replace />} />
          <Route path="/voice-tts" element={<VoiceTTS />} />
          <Route path="/tools/text" element={<TextGenerator />} />
          <Route path="/tools/text/translation/:id" element={<TextTranslationView />} />
          <Route path="/tools/voice-studio" element={<VoiceStudio />} />
          <Route path="/tools/voice" element={<VoiceStudio />} />
          <Route path="/tools/game" element={<GameMode />} />
          <Route path="/my-warranty" element={<MyWarranty />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={
            <DebugContextProvider>
              <ProjectDetail />
            </DebugContextProvider>
          } />
          <Route path="/wakti-agent" element={<WaktiAgent />} />
          <Route path="/help" element={<Help />} />
          <Route path="/fitness" element={<Vitality />} />
          <Route path="/fitness/callback" element={<FitnessWhoopCallback />} />
          <Route path="/whoop/callback" element={<FitnessWhoopCallback />} />
          <Route path="/wishlists" element={<MyWishlists />} />
          <Route path="/gallery/:userId" element={<ContactGallery />} />
          <Route path="/deen" element={<Deen />} />
          <Route path="/deen/quran" element={<DeenQuran />} />
          <Route path="/deen/hadith" element={<DeenHadith />} />
          <Route path="/deen/ask" element={<DeenAsk />} />
          <Route path="/deen/study" element={<DeenStudy />} />
          <Route path="/deen/azkar" element={<DeenAzkar />} />
        </Route>

        {/* ── Preview & slug routes ──────────────────────────────────────── */}
        <Route path="/preview/:subdomain" element={<ProjectPreview />} />
        <Route path="/:slug" element={<ProjectSlugRedirect />} />

        {/* ── 404 ───────────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
