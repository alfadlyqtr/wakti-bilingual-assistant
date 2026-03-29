import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GiftNotificationProvider } from "@/components/notifications/GiftNotificationProvider";
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
const Tasjeel = lazy(() => import("@/pages/Tasjeel"));
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
const MyWishlists = lazy(() => import("@/pages/MyWishlists"));
const ContactGallery = lazy(() => import("@/pages/ContactGallery"));

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function ConsumerRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
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
        <Route path="/image/:id" element={<ImageShare />} />
        <Route path="/video/:id" element={<VideoShare />} />
        <Route path="/wallet-pass" element={<WalletPass />} />
        <Route path="/qr/view" element={<QRTextView />} />
        <Route path="/instagram-connect-callback" element={<InstagramConnectCallback />} />

        {/* ── Protected app routes ──────────────────────────────────────── */}
        <Route element={
          <GiftNotificationProvider>
            <ErrorBoundary>
              <AppLayout />
            </ErrorBoundary>
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
          <Route path="/tasjeel" element={<Tasjeel />} />
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
          <Route path="/help" element={<Help />} />
          <Route path="/fitness" element={<Vitality />} />
          <Route path="/fitness/callback" element={<FitnessWhoopCallback />} />
          <Route path="/whoop/callback" element={<FitnessWhoopCallback />} />
          <Route path="/wishlists" element={<MyWishlists />} />
          <Route path="/gallery/:userId" element={<ContactGallery />} />
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
