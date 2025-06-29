import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from '@/components/ui/sonner';
import { SpeedInsights } from "@vercel/speed-insights/react"

import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Contacts from './pages/Contacts';
import Maw3d from './pages/Maw3d';
import Maw3dManage from './pages/Maw3dManage';
import Maw3dCreate from './pages/Maw3dCreate';
import Maw3dEvents from './pages/Maw3dEvents';
import Maw3dEvent from './pages/Maw3dEvent';
import Maw3dEventEdit from './pages/Maw3dEventEdit';
import Maw3dEventRsvp from './pages/Maw3dEventRsvp';
import Maw3dEventRsvpEdit from './pages/Maw3dEventRsvpEdit';
import CalendarPage from './pages/CalendarPage';
import Tasks from './pages/Tasks';
import TaskDetails from './pages/TaskDetails';
import CreateTask from './pages/CreateTask';
import EditTask from './pages/EditTask';
import WaktiAi from './pages/WaktiAi';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminQuotas from './pages/AdminQuotas';
import AdminNotifications from './pages/AdminNotifications';
import AdminLogs from './pages/AdminLogs';
import AdminLogin from './pages/AdminLogin';
import AdminProfile from './pages/AdminProfile';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminSubscription from './pages/AdminSubscription';
import AdminMobileNav from './components/admin/AdminMobileNav';
import Pricing from './pages/Pricing';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import VoiceCloning from './pages/VoiceCloning';
import VoiceCloningDetails from './pages/VoiceCloningDetails';
import VoiceCloningCreate from './pages/VoiceCloningCreate';
import VoiceCloningEdit from './pages/VoiceCloningEdit';
import VoiceCloningPricing from './pages/VoiceCloningPricing';
import VoiceChat from './pages/VoiceChat';
import VoiceChatDetails from './pages/VoiceChatDetails';
import VoiceChatCreate from './pages/VoiceChatCreate';
import VoiceChatEdit from './pages/VoiceChatEdit';
import VoiceChatPricing from './pages/VoiceChatPricing';
import VoiceLibrary from './pages/VoiceLibrary';
import VoiceLibraryDetails from './pages/VoiceLibraryDetails';
import VoiceLibraryPricing from './pages/VoiceLibraryPricing';
import TranslationRequest from './pages/TranslationRequest';
import TranslationRequestDetails from './pages/TranslationRequestDetails';
import TranslationRequestCreate from './pages/TranslationRequestCreate';
import TranslationRequestEdit from './pages/TranslationRequestEdit';
import TranslationRequestPricing from './pages/TranslationRequestPricing';
import LegalTerms from './pages/LegalTerms';
import LegalPrivacy from './pages/LegalPrivacy';
import LegalCookies from './pages/LegalCookies';
import NotFound from './pages/NotFound';
import ComingSoon from './pages/ComingSoon';
import Help from './pages/Help';
import HelpArticle from './pages/HelpArticle';
import HelpCategory from './pages/HelpCategory';
import HelpSearch from './pages/HelpSearch';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import BlogCategory from './pages/BlogCategory';
import BlogSearch from './pages/BlogSearch';
import ContactUs from './pages/ContactUs';
import AboutUs from './pages/AboutUs';
import Careers from './pages/Careers';
import CareersDetails from './pages/CareersDetails';
import Press from './pages/Press';
import PressDetails from './pages/PressDetails';
import Faq from './pages/Faq';
import FaqCategory from './pages/FaqCategory';
import FaqSearch from './pages/FaqSearch';
import Sitemap from './pages/Sitemap';
import Status from './pages/Status';
import StatusDetails from './pages/StatusDetails';
import StatusCategory from './pages/StatusCategory';
import StatusSearch from './pages/StatusSearch';
import PasswordReset from './pages/PasswordReset';
import EmailVerification from './pages/EmailVerification';
import { GiftNotificationProvider } from '@/components/GiftNotificationProvider';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <SpeedInsights />
            <Toaster />
            <GiftNotificationProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/maw3d" element={<Maw3d />} />
                <Route path="/maw3d/manage/:eventId" element={<Maw3dManage />} />
                <Route path="/maw3d/create" element={<Maw3dCreate />} />
                <Route path="/maw3d/events" element={<Maw3dEvents />} />
                <Route path="/maw3d/event/:eventId" element={<Maw3dEvent />} />
                <Route path="/maw3d/event/:eventId/edit" element={<Maw3dEventEdit />} />
                <Route path="/maw3d/event/:eventId/rsvp" element={<Maw3dEventRsvp />} />
                <Route path="/maw3d/event/:eventId/rsvp/edit" element={<Maw3dEventRsvpEdit />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/tr" element={<Tasks />} />
                <Route path="/tr/:taskId" element={<TaskDetails />} />
                <Route path="/tr/create" element={<CreateTask />} />
                <Route path="/tr/:taskId/edit" element={<EditTask />} />
                <Route path="/wakti-ai" element={<WaktiAi />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/quotas" element={<AdminQuotas />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/logs" element={<AdminLogs />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/profile" element={<AdminProfile />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/subscription" element={<AdminSubscription />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/checkout/success" element={<CheckoutSuccess />} />
                <Route path="/checkout/cancel" element={<CheckoutCancel />} />
                <Route path="/voice-cloning" element={<VoiceCloning />} />
                <Route path="/voice-cloning/:voiceId" element={<VoiceCloningDetails />} />
                <Route path="/voice-cloning/create" element={<VoiceCloningCreate />} />
                <Route path="/voice-cloning/:voiceId/edit" element={<VoiceCloningEdit />} />
                <Route path="/voice-cloning/pricing" element={<VoiceCloningPricing />} />
                <Route path="/voice-chat" element={<VoiceChat />} />
                <Route path="/voice-chat/:chatId" element={<VoiceChatDetails />} />
                <Route path="/voice-chat/create" element={<VoiceChatCreate />} />
                <Route path="/voice-chat/:chatId/edit" element={<VoiceChatEdit />} />
                <Route path="/voice-chat/pricing" element={<VoiceChatPricing />} />
                <Route path="/voice-library" element={<VoiceLibrary />} />
                <Route path="/voice-library/:voiceId" element={<VoiceLibraryDetails />} />
                <Route path="/voice-library/pricing" element={<VoiceLibraryPricing />} />
                <Route path="/translation-request" element={<TranslationRequest />} />
                <Route path="/translation-request/:requestId" element={<TranslationRequestDetails />} />
                <Route path="/translation-request/create" element={<TranslationRequestCreate />} />
                <Route path="/translation-request/:requestId/edit" element={<TranslationRequestEdit />} />
                <Route path="/translation-request/pricing" element={<TranslationRequestPricing />} />
                <Route path="/legal/terms" element={<LegalTerms />} />
                <Route path="/legal/privacy" element={<LegalPrivacy />} />
                <Route path="/legal/cookies" element={<LegalCookies />} />
                <Route path="/password-reset" element={<PasswordReset />} />
                <Route path="/email-verification" element={<EmailVerification />} />
                <Route path="/not-found" element={<NotFound />} />
                <Route path="/coming-soon" element={<ComingSoon />} />
                <Route path="/help" element={<Help />} />
                <Route path="/help/article/:articleId" element={<HelpArticle />} />
                <Route path="/help/category/:categoryId" element={<HelpCategory />} />
                <Route path="/help/search" element={<HelpSearch />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/post/:postId" element={<BlogPost />} />
                <Route path="/blog/category/:categoryId" element={<BlogCategory />} />
                <Route path="/blog/search" element={<BlogSearch />} />
                <Route path="/contact-us" element={<ContactUs />} />
                <Route path="/about-us" element={<AboutUs />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/careers/:careerId" element={<CareersDetails />} />
                <Route path="/press" element={<Press />} />
                <Route path="/press/:pressId" element={<PressDetails />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/faq/category/:categoryId" element={<FaqCategory />} />
                <Route path="/faq/search" element={<FaqSearch />} />
                <Route path="/sitemap" element={<Sitemap />} />
                <Route path="/status" element={<Status />} />
                <Route path="/status/:statusId" element={<StatusDetails />} />
                <Route path="/status/category/:categoryId" element={<StatusCategory />} />
                <Route path="/status/search" element={<StatusSearch />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </GiftNotificationProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}

export default App;
