import React, { Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AppShellSkeleton } from "@/components/ui/AppShellSkeleton";
import { AppLayout } from "@/components/AppLayout";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
import { ImageShareNotificationProvider } from "@/components/notifications/ImageShareNotificationProvider";
import { MusicShareNotificationProvider } from "@/components/notifications/MusicShareNotificationProvider";
import { ProjectShareNotificationProvider } from "@/components/notifications/ProjectShareNotificationProvider";
import { TaskShareNotificationProvider } from "@/components/notifications/TaskShareNotificationProvider";
import { GameInviteNotificationProvider } from "@/components/notifications/GameInviteNotificationProvider";
import { MessageNotificationProvider } from "@/components/notifications/MessageNotificationProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DebugContextProvider } from "@/hooks/useDebugContext";
import { lazyRetry } from "@/utils/lazyLoading";

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
const Dashboard = lazyRetry(() => import("@/pages/Dashboard"));
const Account = lazyRetry(() => import("@/pages/Account"));
const Settings = lazyRetry(() => import("@/pages/Settings"));
const TasksReminders = lazyRetry(() => import("@/pages/TasksReminders"));
const WaktiAi = lazyRetry(() => import("@/pages/WaktiAi"));
const WaktiAIV2 = lazyRetry(() => import("@/pages/WaktiAIV2"));
const WaktiAgent = lazyRetry(() => import("@/pages/WaktiAgent"));
const Calendar = lazyRetry(() => import("@/pages/Calendar"));
const Social = lazyRetry(() => import("@/pages/Social"));
const Contacts = lazyRetry(() => import("@/pages/Contacts"));
const ChatPage = lazyRetry(() => import("@/pages/ChatPage"));
const GroupChatPage = lazyRetry(() => import("@/pages/GroupChatPage"));
const Maw3d = lazyRetry(() => import("@/pages/Maw3d"));
const Maw3dCreate = lazyRetry(() => import("@/pages/Maw3dCreate"));
const Maw3dManage = lazyRetry(() => import("@/pages/Maw3dManage"));
const Maw3dView = lazyRetry(() => import("@/pages/Maw3dView"));
const Maw3dEdit = lazyRetry(() => import("@/pages/Maw3dEdit"));
const SharedTask = lazyRetry(() => import("@/pages/SharedTask"));
const ContactUs = lazyRetry(() => import("@/pages/ContactUs"));
const Help = lazyRetry(() => import("@/pages/Help"));
const PrivacyTerms = lazyRetry(() => import("@/pages/PrivacyTerms"));
const VoiceTTS = lazyRetry(() => import("@/pages/VoiceTTS"));
const VoiceStudio = lazyRetry(() => import("@/pages/VoiceStudio"));
const TextGenerator = lazyRetry(() => import("@/pages/TextGenerator"));
const Email = lazyRetry(() => import("@/pages/Email"));
const TextTranslationView = lazyRetry(() => import("@/pages/TextTranslationView"));
const GameMode = lazyRetry(() => import("@/pages/GameMode"));
const Games = lazyRetry(() => import("@/pages/Games"));
const Vitality = lazyRetry(() => import("@/pages/Vitality"));
const FitnessWhoopCallback = lazyRetry(() => import("@/pages/FitnessWhoopCallback"));
const Journal = lazyRetry(() => import("@/pages/Journal"));
const MusicStudio = lazyRetry(() => import("@/pages/MusicStudio"));
const MusicShare = lazyRetry(() => import("@/pages/MusicShare"));
const PosterShare = lazyRetry(() => import("@/pages/PosterShare"));
const ImageShare = lazyRetry(() => import("@/pages/ImageShare"));
const VideoShare = lazyRetry(() => import("@/pages/VideoShare"));
const BusinessCardShare = lazyRetry(() => import("@/pages/BusinessCardShare"));
const WalletPass = lazyRetry(() => import("@/pages/WalletPass"));
const QRTextView = lazyRetry(() => import("@/pages/QRTextView"));
const QRCTAView = lazyRetry(() => import("@/pages/QRCTAView"));
const LettersAiSetup = lazyRetry(() => import("@/pages/LettersAiSetup"));
const LettersAiPlay = lazyRetry(() => import("@/pages/LettersAiPlay"));
const LettersCreate = lazyRetry(() => import("@/pages/LettersCreate"));
const LettersWaiting = lazyRetry(() => import("@/pages/LettersWaiting"));
const LettersJoin = lazyRetry(() => import("@/pages/LettersJoin"));
const LettersPlay = lazyRetry(() => import("@/pages/LettersPlay"));
const LettersResults = lazyRetry(() => import("@/pages/LettersResults"));
const PresentationSharePlayer = lazyRetry(() => import("@/pages/PresentationSharePlayer"));
const DiagramView = lazyRetry(() => import("@/pages/DiagramView"));
const MyWarranty = lazyRetry(() => import("@/pages/MyWarranty"));
const Projects = lazyRetry(() => import("@/pages/Projects"));
const ProjectDetail = lazyRetry(() => import("@/pages/ProjectDetail"));
const ProjectSlugRedirect = lazyRetry(() => import("@/pages/ProjectSlugRedirect"));
const ProjectPreview = lazyRetry(() => import("@/pages/ProjectPreview"));
const ChatbotPage = lazyRetry(() => import("@/pages/ChatbotPage"));
const InstagramConnectCallback = lazyRetry(() => import("@/pages/InstagramConnectCallback"));
const GoogleAuthCallback = lazyRetry(() => import("@/pages/GoogleAuthCallback"));
const GoogleSignInCallback = lazyRetry(() => import("@/pages/GoogleSignInCallback"));
const MyWishlists = lazyRetry(() => import("@/pages/MyWishlists"));
const PublicWishlist = lazyRetry(() => import("@/pages/PublicWishlist"));
const ContactGallery = lazyRetry(() => import("@/pages/ContactGallery"));
const Deen = lazyRetry(() => import("@/pages/Deen"));
const DeenQuran = lazyRetry(() => import("@/pages/DeenQuran"));
const DeenHadith = lazyRetry(() => import("@/pages/DeenHadith"));
const DeenAsk = lazyRetry(() => import("@/pages/DeenAsk"));
const DeenStudy = lazyRetry(() => import("@/pages/DeenStudy"));
const DeenAzkar = lazyRetry(() => import("@/pages/DeenAzkar"));
const DeenPrayerTimes = lazyRetry(() => import("@/pages/DeenPrayerTimes"));

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
    const prefetchRoutes = ['/', '/home', '/login', '/signup', '/confirmed', '/auth/confirm', '/auth/google/sign-in'];
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
        <Route path="/qr/cta" element={<QRCTAView />} />
        <Route path="/instagram-connect-callback" element={<InstagramConnectCallback />} />
        <Route path="/auth/google/sign-in" element={<GoogleSignInCallback />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

        {/* ── Protected app routes ──────────────────────────────────────── */}
        <Route element={
          <GiftNotificationProvider>
            <ImageShareNotificationProvider>
              <MusicShareNotificationProvider>
                <ProjectShareNotificationProvider>
                  <TaskShareNotificationProvider>
                    <GameInviteNotificationProvider>
                      <MessageNotificationProvider>
                        <ErrorBoundary>
                          <AppLayout />
                        </ErrorBoundary>
                      </MessageNotificationProvider>
                    </GameInviteNotificationProvider>
                  </TaskShareNotificationProvider>
                </ProjectShareNotificationProvider>
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
          <Route path="/wakti-agent" element={<WaktiAgent />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/music" element={<MusicStudio />} />
          <Route path="/games/letters/ai" element={<LettersAiSetup />} />
          <Route path="/games/letters/ai/play" element={<LettersAiPlay />} />
          <Route path="/games/letters/create" element={<LettersCreate />} />
          <Route path="/games/letters/join" element={<LettersJoin />} />
          <Route path="/games/letters/waiting" element={<LettersWaiting />} />
          <Route path="/games/letters/play/:code" element={<LettersPlay />} />
          <Route path="/games/letters/results/:code" element={<LettersResults />} />
          <Route path="/games" element={<Games />} />
          <Route path="/social" element={<Social />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/contacts/:contactId" element={<ChatPage />} />
          <Route path="/group-chats/:conversationId" element={<GroupChatPage />} />
          <Route path="/maw3d" element={<Maw3d />} />
          <Route path="/maw3d/create" element={<Maw3dCreate />} />
          <Route path="/maw3d/manage/:id" element={<Maw3dManage />} />
          <Route path="/maw3d/edit/:id" element={<Maw3dEdit />} />
          <Route path="/tasjeel" element={<Navigate to="/tools/voice-studio?tab=tasjeel" replace />} />
          <Route path="/voice-tts" element={<VoiceTTS />} />
          <Route path="/tools/text" element={<TextGenerator />} />
          <Route path="/tools/email" element={<Email />} />
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
          <Route path="/deen/prayer-times" element={<DeenPrayerTimes />} />
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
