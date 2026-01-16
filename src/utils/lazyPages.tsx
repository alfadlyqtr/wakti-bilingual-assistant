import React, { lazy, Suspense } from 'react';
import { PageLoadingSkeleton, CardSkeleton, ListSkeleton } from './lazyLoading';
import { Loader2 } from 'lucide-react';

// ============================================================================
// LAZY PAGE LOADER UTILITY
// Route-based code splitting for optimal initial bundle size
// ============================================================================

/**
 * Minimal loader for simple pages
 */
function MinimalLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Dashboard-style loading skeleton
 */
function DashboardLoader() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * AI Coder loading skeleton (ProjectDetail)
 */
function AICoderLoader() {
  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel */}
      <div className="w-[400px] border-r border-border p-4 space-y-4">
        <div className="h-8 w-full bg-muted animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
      {/* Right Panel */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading AI Coder...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Calendar loading skeleton
 */
function CalendarLoader() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4">
      <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/**
 * Chat loading skeleton
 */
function ChatLoader() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-16 border-b border-border flex items-center px-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
      </div>
      <div className="flex-1 p-4 space-y-4">
        <ListSkeleton count={5} />
      </div>
    </div>
  );
}

/**
 * Admin loading skeleton
 */
function AdminLoader() {
  return (
    <div className="min-h-screen bg-zinc-900 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 bg-zinc-800 animate-pulse rounded-lg" />
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-zinc-800 animate-pulse rounded-lg" />
          <div className="h-10 w-24 bg-zinc-800 animate-pulse rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-zinc-800 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LAZY PAGE EXPORTS
// Each page is lazy-loaded with an appropriate loading skeleton
// ============================================================================

// ---- Public Pages ----
export const LazyIndex = lazy(() => import('@/pages/Index'));
export const LazyLogin = lazy(() => import('@/pages/Login'));
export const LazySignup = lazy(() => import('@/pages/Signup'));
export const LazyForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
export const LazyResetPassword = lazy(() => import('@/pages/ResetPassword'));
export const LazyResetSuccess = lazy(() => import('@/pages/ResetSuccess'));
export const LazyContactUs = lazy(() => import('@/pages/ContactUs'));
export const LazyHelp = lazy(() => import('@/pages/Help'));
export const LazyPrivacyTerms = lazy(() => import('@/pages/PrivacyTerms'));
export const LazyAccountDelete = lazy(() => import('@/pages/AccountDelete'));
export const LazyGoodbyeScreen = lazy(() => import('@/pages/GoodbyeScreen'));
export const LazyConfirmed = lazy(() => import('@/pages/Confirmed'));
export const LazyAuthConfirm = lazy(() => import('@/pages/AuthConfirm'));
export const LazyNotFound = lazy(() => import('@/pages/NotFound'));
export const LazySessionEnded = lazy(() => import('@/pages/SessionEnded'));
export const LazySharedTask = lazy(() => import('@/pages/SharedTask'));
export const LazyPresentationSharePlayer = lazy(() => import('@/pages/PresentationSharePlayer'));
export const LazyMaw3dView = lazy(() => import('@/pages/Maw3dView'));
export const LazyMusicShare = lazy(() => import('@/pages/MusicShare'));
export const LazyVideoShare = lazy(() => import('@/pages/VideoShare'));

// ---- Protected User Pages ----
export const LazyDashboard = lazy(() => import('@/pages/Dashboard'));
export const LazyAccount = lazy(() => import('@/pages/Account'));
export const LazySettings = lazy(() => import('@/pages/Settings'));
export const LazyTasksReminders = lazy(() => import('@/pages/TasksReminders'));
export const LazyWaktiAi = lazy(() => import('@/pages/WaktiAi'));
export const LazyWaktiAIV2 = lazy(() => import('@/pages/WaktiAIV2'));
export const LazyCalendar = lazy(() => import('@/pages/Calendar'));
export const LazyContacts = lazy(() => import('@/pages/Contacts'));
export const LazyChatPage = lazy(() => import('@/pages/ChatPage'));
export const LazyMaw3d = lazy(() => import('@/pages/Maw3d'));
export const LazyMaw3dCreate = lazy(() => import('@/pages/Maw3dCreate'));
export const LazyMaw3dManage = lazy(() => import('@/pages/Maw3dManage'));
export const LazyMaw3dEdit = lazy(() => import('@/pages/Maw3dEdit'));
export const LazyTasjeel = lazy(() => import('@/pages/Tasjeel'));
export const LazyVoiceTTS = lazy(() => import('@/pages/VoiceTTS'));
export const LazyVoiceStudio = lazy(() => import('@/pages/VoiceStudio'));
export const LazyTextGenerator = lazy(() => import('@/pages/TextGenerator'));
export const LazyTextTranslationView = lazy(() => import('@/pages/TextTranslationView'));
export const LazyGameMode = lazy(() => import('@/pages/GameMode'));
export const LazyGames = lazy(() => import('@/pages/Games'));
export const LazyFitnessHealth = lazy(() => import('@/pages/FitnessHealth'));
export const LazyFitnessWhoopCallback = lazy(() => import('@/pages/FitnessWhoopCallback'));
export const LazyJournal = lazy(() => import('@/pages/Journal'));
export const LazyMusicStudio = lazy(() => import('@/pages/MusicStudio'));
export const LazyLettersCreate = lazy(() => import('@/pages/LettersCreate'));
export const LazyLettersWaiting = lazy(() => import('@/pages/LettersWaiting'));
export const LazyLettersJoin = lazy(() => import('@/pages/LettersJoin'));
export const LazyLettersPlay = lazy(() => import('@/pages/LettersPlay'));
export const LazyLettersResults = lazy(() => import('@/pages/LettersResults'));
export const LazyMyWarranty = lazy(() => import('@/pages/MyWarranty'));
export const LazyProjects = lazy(() => import('@/pages/Projects'));
export const LazyProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
export const LazyProjectSlugRedirect = lazy(() => import('@/pages/ProjectSlugRedirect'));
export const LazyProjectPreview = lazy(() => import('@/pages/ProjectPreview'));

// ---- Admin Pages ----
export const LazyAdminLogin = lazy(() => import('@/pages/AdminLogin'));
export const LazyAdminSetup = lazy(() => import('@/pages/AdminSetup'));
export const LazyAdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
export const LazyAdminUsers = lazy(() => import('@/pages/AdminUsers'));
export const LazyAdminMessages = lazy(() => import('@/pages/AdminMessages'));
export const LazyAdminSubscriptions = lazy(() => import('@/pages/AdminSubscriptions'));
export const LazyAdminQuotas = lazy(() => import('@/pages/AdminQuotas'));
export const LazyAdminAnalytics = lazy(() => import('@/pages/AdminAnalytics'));
export const LazyAdminSettings = lazy(() => import('@/pages/AdminSettings'));
export const LazyAdminAuditLog = lazy(() => import('@/pages/AdminAuditLog'));
export const LazyAdminAIUsage = lazy(() => import('@/pages/AdminAIUsage'));

// ============================================================================
// SUSPENSE WRAPPERS
// Pre-built components with appropriate fallbacks
// ============================================================================

interface SuspensePageProps {
  children: React.ReactNode;
  loader?: 'minimal' | 'dashboard' | 'ai-coder' | 'calendar' | 'chat' | 'admin' | 'full';
}

export function SuspensePage({ children, loader = 'minimal' }: SuspensePageProps) {
  const getFallback = () => {
    switch (loader) {
      case 'dashboard':
        return <DashboardLoader />;
      case 'ai-coder':
        return <AICoderLoader />;
      case 'calendar':
        return <CalendarLoader />;
      case 'chat':
        return <ChatLoader />;
      case 'admin':
        return <AdminLoader />;
      case 'full':
        return <PageLoadingSkeleton />;
      default:
        return <MinimalLoader />;
    }
  };

  return <Suspense fallback={getFallback()}>{children}</Suspense>;
}

// Export loaders for custom use
export { 
  MinimalLoader, 
  DashboardLoader, 
  AICoderLoader, 
  CalendarLoader, 
  ChatLoader, 
  AdminLoader 
};
