import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DesktopLayout } from "@/components/layouts/DesktopLayout";
import { TabletLayout } from "@/components/layouts/TabletLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { purchasePackage, restorePurchases, getOfferings, purchasesLogin } from "@/integrations/natively/purchasesBridge";
import { setupNotificationClickHandler } from "@/integrations/natively/notificationsBridge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, LogOut, Home, Shield, Clock, MessageCircle, X } from "lucide-react";
import type { PaywallVariant } from "@/components/ProtectedRoute";
import { Logo3D } from "@/components/Logo3D";
import { toast } from "sonner";

interface AppLayoutProps {
  children?: React.ReactNode;
}

interface UnreadContextType {
  unreadTotal: number;
  taskCount: number;
  maw3dEventCount: number;
  contactCount: number;
  sharedTaskCount: number;
  perContactUnread: Record<string, number>;
  refetch: () => void;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadTotal: 0,
  taskCount: 0,
  maw3dEventCount: 0,
  contactCount: 0,
  sharedTaskCount: 0,
  perContactUnread: {},
  refetch: () => {}
});

export const useUnreadContext = () => useContext(UnreadContext);

interface CustomPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: PaywallVariant;
}

function CustomPaywallModal({ open, onOpenChange, variant }: CustomPaywallModalProps) {
  const { language, setLanguage } = useTheme();
  const { signOut, user } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [price, setPrice] = useState<{ qar?: string; usd?: string }>({});
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [activePackageId, setActivePackageId] = useState<string>('$rc_monthly');
  const [step, setStep] = useState(variant === 'new_user' ? 1 : 2);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const contactUrl = "https://wa.me/97433994166";
  const rawName = profile?.display_name || (profile as any)?.first_name || profile?.username || user?.email || '';
  const userName = rawName.includes('@') ? rawName.split('@')[0] : rawName;

  useEffect(() => {
    // When paywall is open, allow header popovers to appear above overlay
    if (open) {
      document.body.classList.add('paywall-open');
    } else {
      document.body.classList.remove('paywall-open');
    }
    return () => {
      document.body.classList.remove('paywall-open');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(variant === 'new_user' ? 1 : 2);
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    getOfferings((resp) => {
      if (resp?.status === 'SUCCESS' && resp?.offerings?.current) {
        const pkg = resp.offerings.current.availablePackages?.find(
          (p: any) => p.identifier === '$rc_monthly'
        ) || resp.offerings.current.availablePackages?.[0];
        if (pkg?.product) {
          setActivePackageId(pkg.identifier);
          setPrice({
            qar: pkg.product.priceString || 'QAR 92/month',
            usd: pkg.product.priceUSD || '$25/month',
          });
        }
      }
    });
  }, [open]);

  // Android fix: Detect app re-foreground after Google Play purchase
  useEffect(() => {
    if (!open || !purchaseInProgress) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && purchaseInProgress) {
        console.log('[Purchase] App re-foregrounded, checking subscription status...');
        
        // Wait 2s for RevenueCat to sync with backend
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!user?.id) return;
        
        try {
          const { data, error } = await supabase.functions.invoke('check-subscription', {
            body: { userId: user.id }
          });
          
          console.log('[Purchase] Post-foreground check result:', data, error);
          
          if (data?.isSubscribed) {
            toast.success(language === 'ar' ? 'تم الاشتراك بنجاح!' : 'Subscription successful!');
            setPurchaseInProgress(false);
            setLoading(false);
            
            // Clear cache and force ProtectedRoute refresh
            try {
              localStorage.removeItem(`wakti_sub_status_${user.id}`);
              window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
            } catch {}
            
            setTimeout(() => onOpenChange(false), 1000);
          } else {
            // Still not subscribed - reset UI
            setPurchaseInProgress(false);
            setLoading(false);
          }
        } catch (err) {
          console.error('[Purchase] Post-foreground check failed:', err);
          setPurchaseInProgress(false);
          setLoading(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [open, purchaseInProgress, user?.id, language, onOpenChange]);

  const handleSubscribe = async () => {
    setLoading(true);
    setPurchaseInProgress(true);
    
    purchasePackage(activePackageId, async (resp: any) => {
      console.log('[Purchase] Response:', resp);
      
      // Treat success OR 'already subscribed' (Android) as a successful subscription
      const isAlreadySubscribed = resp?.status === 'ERROR' && typeof resp?.message === 'string' &&
        resp.message.toLowerCase().includes('already subscribed');
      const isPurchased = resp?.status === 'SUCCESS' && resp?.message === 'purchased';

      if (isPurchased || isAlreadySubscribed) {
        // Update Supabase directly after successful purchase
        if (user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({
                is_subscribed: true,
                subscription_status: 'active',
                plan_name: 'Wakti Monthly',
                billing_start_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
            console.log('[Purchase] Supabase updated successfully');
          } catch (err) {
            console.error('[Purchase] Supabase update failed:', err);
          }
        }
        
        toast.success(language === 'ar' ? 'تم الاشتراك بنجاح!' : 'Subscription successful!');
        setPurchaseInProgress(false);
        
        // IMMEDIATELY clear cache and dispatch update events — do NOT wait for check-subscription
        // This closes the paywall right away on iOS/sandbox where RC sync can be slow
        if (user?.id) {
          try {
            localStorage.removeItem(`wakti_sub_status_${user.id}`);
            window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
            window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
          } catch {}
          // Fire check-subscription in background to sync RC data — non-blocking
          supabase.functions.invoke('check-subscription', { body: { userId: user.id } })
            .then(({ data }) => { console.log('[Purchase] Background RC sync:', data?.isSubscribed); })
            .catch(err => { console.warn('[Purchase] Background RC sync failed:', err); });
        }
        
        setTimeout(() => onOpenChange(false), 1000);
      } else if (resp?.status === 'ERROR') {
        toast.error(resp?.message || (language === 'ar' ? 'فشل الاشتراك' : 'Purchase failed'));
        setPurchaseInProgress(false);
      }
      setLoading(false);
    });
    
    // Android fallback: If callback never fires after 30s, rely on visibilitychange
    setTimeout(() => {
      if (purchaseInProgress) {
        console.log('[Purchase] Callback timeout - waiting for visibilitychange');
      }
    }, 30000);
  };

  // Restore purchases handler - per RevenueCat docs, SUCCESS means restore completed,
  // but we must verify entitlements via backend to confirm purchases were actually found
  const handleRestore = () => {
    setRestoring(true);
    
    // Call native restore - Natively SDK talks to Apple/RevenueCat
    // Callback receives: { status: 'SUCCESS' | 'FAILED', customerId, error }
    // NOTE: SUCCESS only means the restore operation completed, NOT that purchases were found!
    restorePurchases((resp: any) => {
      console.log('[Restore] Native SDK response:', resp);
      
      try {
        // After restore (success or fail), we MUST check backend to verify entitlements
        const verifySubscription = () => {
          if (!user?.id) {
            toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            setRestoring(false);
            return;
          }
          
          // Check subscription via RevenueCat REST API (our backend)
          supabase.functions.invoke('check-subscription', {
            body: { userId: user.id }
          }).then(({ data, error }) => {
            console.log('[Restore] Backend verification result:', data, error);
            
            if (data?.isSubscribed) {
              // Purchases were found and restored!
              toast.success(language === 'ar' ? 'تم استعادة المشتريات!' : 'Purchases restored!');
              setRestoring(false);
              
              // Clear cache and force ProtectedRoute refresh
              if (user?.id) {
                try {
                  localStorage.removeItem(`wakti_sub_status_${user.id}`);
                  window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
                } catch {}
              }
              
              // Wait 1s for ProtectedRoute to refresh before closing
              setTimeout(() => onOpenChange(false), 1000);
            } else {
              // No purchases found
              toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
              setRestoring(false);
            }
          }).catch(err => {
            console.error('[Restore] Backend verification failed:', err);
            toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            setRestoring(false);
          });
        };
        
        // If native restore succeeded, verify with backend
        if (resp?.status === 'SUCCESS') {
          console.log('[Restore] Native restore completed, verifying with backend...');
          verifySubscription();
          return;
        }
        
        // Native restore failed - still try backend verification
        // (handles cross-device restore where native has no local receipt)
        console.log('[Restore] Native restore status:', resp?.status, 'Error:', resp?.error);
        console.log('[Restore] Trying backend verification as fallback...');
        verifySubscription();
        
      } catch (err) {
        console.error('[Restore] Error in callback:', err);
        toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
        setRestoring(false);
      }
    });
  };

  const handleLogout = async () => {
    await signOut();
    onOpenChange(false);
    navigate('/login');
  };

  const handleSkip = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('profiles')
        .update({
          free_access_start_at: new Date().toISOString(),
          trial_popup_shown: true
        })
        .eq('id', user.id);

      // Schedule push notifications at 12h, 22h, and 24h
      try {
        const now = new Date();
        const pushMessages = [
          { delayHours: 12, en: '12 hours left of your Wakti trial subscribe now and get 3 more free days', ar: 'باقي 12 ساعة على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية' },
          { delayHours: 22, en: '2 hours left of your Wakti trial subscribe now and get 3 more free days', ar: 'باقي ساعتين على انتهاء تجربتك في وقتي اشترك الآن واحصل على 3 أيام مجانية إضافية' },
          { delayHours: 24, en: 'Your Wakti trial has ended. Subscribe to continue guess what you still get 3 more free days', ar: 'انتهت تجربتك في وقتي. اشترك للمتابعة والمفاجأة، لا تزال تحصل على 3 أيام مجانية' },
        ];
        for (const msg of pushMessages) {
          const sendAt = new Date(now.getTime() + msg.delayHours * 60 * 60 * 1000);
          supabase.functions.invoke('schedule-reminder-push', {
            body: {
              userId: user.id,
              title: 'Wakti AI',
              message: language === 'ar' ? msg.ar : msg.en,
              scheduledFor: sendAt.toISOString(),
              data: { type: 'trial_reminder' }
            }
          }).catch(() => {});
        }
      } catch {}

      // Force profile refresh
      window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
      onOpenChange(false);
      toast.success(language === 'ar' ? 'مرحباً بك في وقتي!' : 'Welcome to Wakti!');

      // OneSignal Web Push: request notification permission on trial start
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal: any) {
        try {
          await OneSignal.Notifications.requestPermission();
          console.log('[Paywall] OneSignal Web Push permission requested');
        } catch (err) {
          console.warn('[Paywall] OneSignal Web Push permission request failed:', err);
        }
      });
    } catch (err) {
      console.error('[Paywall] Skip/trial start failed:', err);
    }
  };

  // Variant-based subtitles
  const subtitles = {
    new_user: {
      en: 'Unlock all Super AI features. Start your 3-day free trial now.',
      ar: 'افتح جميع ميزات الذكاء الاصطناعي. ابدأ تجربتك المجانية لمدة 3 أيام الآن.'
    },
    cancelled: {
      en: 'Welcome back to Wakti, nice to have you back!',
      ar: 'مرحباً بعودتك إلى وقتي، سعداء بعودتك!'
    },
    trial_expired: {
      en: 'Hope you enjoyed Wakti! Subscribe now and you still get 3 more free days.',
      ar: 'نتمنى أنك استمتعت بوقتي! اشترك الآن ولا تزال تحصل على 3 أيام مجانية إضافية.'
    }
  };

  const features = {
    en: [
      { title: 'WAKTI AI', sublabel: '(chat • search • study)' },
      { title: 'Generator', sublabel: '(image • video • music)' },
      { title: 'Maw3d Events' },
      { title: 'Contacts & Messaging' },
      { title: 'WAKTI Journal' },
      { title: 'Voice Cloning' },
      { title: 'Voice TTS' },
      { title: 'My Documents' },
      { title: 'Tasks & Reminders' },
      { title: 'Tasjeel Voice Recorder' },
      { title: 'Vitality' },
      { title: 'Smart Text Generator' },
      { title: 'AI Games' },
      { title: 'Voice Translation' },
      { title: 'Calendar' },
      { title: 'AI Coding' },
      { title: 'Diagrams' },
      { title: 'PowerPoint Slides' },
    ],
    ar: [
      { title: 'وقتي AI', sublabel: '(دردشة • بحث • دراسة)' },
      { title: 'المولد', sublabel: '(صور • فيديو • موسيقى)' },
      { title: 'مواعيد Maw3d' },
      { title: 'جهات الاتصال والرسائل' },
      { title: 'دفتر يوميات وقطي' },
      { title: 'استنساخ الصوت' },
      { title: 'تحويل النص لصوت' },
      { title: 'مستنداتي' },
      { title: 'المهام والتذكيرات' },
      { title: 'تسجيل (Tasjeel) مسجل الصوت' },
      { title: 'الحيوية' },
      { title: 'مولد النص الذكي' },
      { title: 'ألعاب الذكاء الاصطناعي' },
      { title: 'ترجمة الصوت' },
      { title: 'التقويم' },
      { title: 'الترميز بالذكاء الاصطناعي' },
      { title: 'الرسوم البيانية' },
      { title: 'شرائح PowerPoint' },
    ]
  };

  const lang = (language as 'en' | 'ar') || 'en';
  const subtitle = subtitles[variant]?.[lang] || subtitles.new_user.en;
  const featureList = features[lang] || features.en;

  const showXButton = variant === 'new_user' && step === 2;
  const showSkipButton = variant === 'new_user' && step === 2;
  const showRestorePurchases = variant === 'cancelled' && step === 2;
  const canDismiss = variant === 'new_user' && step === 2;

  return (
    <Dialog open={open} onOpenChange={canDismiss ? onOpenChange : undefined}>
      <DialogContent
        className="w-[95vw] max-w-[95vw] sm:w-[90vw] sm:max-w-[500px] bg-gradient-to-br from-background via-background to-accent/5 border-accent/20 max-h-[90vh] overflow-y-auto rounded-xl"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        hideCloseButton
        onEscapeKeyDown={(e) => { if (!canDismiss) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (!canDismiss) e.preventDefault(); }}
        onInteractOutside={(e) => { if (!canDismiss) e.preventDefault(); }}
      >
        {/* Top bar: logo | language toggle + X (top-right, step 2 only) */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
              className="hover:opacity-70 active:scale-95 transition-all duration-150"
              aria-label="Log out"
              title={language === 'ar' ? 'تسجيل الخروج' : 'Log out'}
            >
              <Logo3D size="sm" className="w-8 h-8" />
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full border border-foreground/20 text-foreground/50 hover:text-foreground/80 hover:border-foreground/40 hover:bg-foreground/5 active:scale-95 transition-all duration-150"
              aria-label="Log out"
            >
              <LogOut className="w-2.5 h-2.5" />
              {language === 'ar' ? 'خروج' : 'Log out'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const other = language === 'ar' ? 'en' : 'ar';
              const label = other === 'en' ? 'English' : 'العربية';
              return (
                <button
                  className="px-3 py-1 text-xs rounded-full border bg-accent/20 border-accent text-foreground"
                  onClick={() => setLanguage?.(other as any)}
                >{label}</button>
              );
            })()}
            {showXButton && (
              <button
                onClick={handleSkip}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] shadow-[0_0_12px_hsl(200,100%,55%,0.5)] hover:shadow-[0_0_20px_hsl(200,100%,55%,0.7)] active:scale-95 transition-all duration-150"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* ── STEP 1: Hello Wall (new_user only) ── */}
        {step === 1 && (
          <>
            <style>{`
              @keyframes wave-hand {
                0%   { transform: rotate(0deg); }
                10%  { transform: rotate(14deg); }
                20%  { transform: rotate(-8deg); }
                30%  { transform: rotate(14deg); }
                40%  { transform: rotate(-4deg); }
                50%  { transform: rotate(10deg); }
                60%  { transform: rotate(0deg); }
                100% { transform: rotate(0deg); }
              }
              @keyframes gradient-shift {
                0%   { background-position: 0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              @keyframes float-up {
                0%   { opacity: 0; transform: translateY(18px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              @keyframes sparkle-pop {
                0%   { opacity: 0; transform: scale(0) rotate(0deg); }
                60%  { opacity: 1; transform: scale(1.3) rotate(20deg); }
                100% { opacity: 0.7; transform: scale(1) rotate(0deg); }
              }
              @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 40px hsl(200,100%,55%,0.6), 0 0 80px hsl(200,100%,55%,0.3); }
                50%       { box-shadow: 0 0 60px hsl(200,100%,60%,0.9), 0 0 120px hsl(280,70%,60%,0.5), 0 0 160px hsl(200,100%,55%,0.2); }
              }
              @keyframes feature-fade {
                0%   { opacity: 0; transform: translateY(10px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              .wave-emoji { display:inline-block; animation: wave-hand 1.8s ease-in-out 0.3s 2; transform-origin: 70% 80%; }
              .gradient-text-animated {
                background: linear-gradient(270deg, hsl(210,100%,75%), hsl(280,60%,80%), hsl(25,95%,70%), hsl(142,76%,65%), hsl(210,100%,75%));
                background-size: 300% 300%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: gradient-shift 4s ease infinite;
              }
              .hello-float { animation: float-up 0.6s ease-out both; }
              .hello-float-1 { animation-delay: 0.1s; }
              .hello-float-2 { animation-delay: 0.25s; }
              .hello-float-3 { animation-delay: 0.4s; }
              .hello-float-4 { animation-delay: 0.55s; }
              .hello-float-5 { animation-delay: 0.7s; }
              .sparkle-1 { animation: sparkle-pop 1s ease-out 0.5s both; }
              .sparkle-2 { animation: sparkle-pop 1s ease-out 0.8s both; }
              .sparkle-3 { animation: sparkle-pop 1s ease-out 1.1s both; }
              .continue-btn-glow { animation: pulse-glow 2.5s ease-in-out infinite; }
            `}</style>

            <div className="space-y-4 py-2">
              {/* Greeting */}
              <div className="text-center space-y-2 pt-1 hello-float hello-float-1">
                {/* Floating sparkles around the wave */}
                <div className="relative inline-block">
                  <span className="wave-emoji text-5xl select-none">👋</span>
                  <span className="sparkle-1 absolute -top-1 -right-3 text-lg select-none">✨</span>
                  <span className="sparkle-2 absolute top-1 -left-4 text-sm select-none">⭐</span>
                  <span className="sparkle-3 absolute -bottom-1 right-0 text-sm select-none">💫</span>
                </div>
                <h2 className="gradient-text-animated text-2xl font-bold leading-snug">
                  {language === 'ar'
                    ? `أهلاً ${userName ? userName + '،' : ''} مرحباً بك في وقتي!`
                    : `Hello${userName ? ' ' + userName : ''}, welcome to Wakti!`}
                </h2>
                {/* Edit profile inline */}
                {!editingName ? (
                  <button
                    onClick={() => {
                      setNameInput(profile?.display_name || '');
                      setUsernameInput(profile?.username || '');
                      setNameError('');
                      setEditingName(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] rounded-full border border-foreground/20 text-foreground/40 hover:text-foreground/70 hover:border-foreground/35 hover:bg-foreground/5 active:scale-95 transition-all duration-150"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    {language === 'ar' ? 'تعديل الملف الشخصي' : 'Set up your profile'}
                  </button>
                ) : (
                  <div className="w-full mt-2 rounded-xl border border-foreground/15 bg-foreground/5 p-3 space-y-2 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] text-foreground/50 font-medium">{language === 'ar' ? 'الاسم الظاهر' : 'Display Name'}</label>
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        placeholder={language === 'ar' ? 'مثال: أحمد محمد' : 'e.g. John Smith'}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-foreground/20 bg-background text-foreground placeholder:text-foreground/30 outline-none focus:border-[hsl(210,100%,65%)] focus:ring-1 focus:ring-[hsl(210,100%,65%,0.3)] transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-foreground/50 font-medium">{language === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40 text-xs">@</span>
                        <input
                          value={usernameInput}
                          onChange={e => { setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')); setNameError(''); }}
                          placeholder={language === 'ar' ? 'مثال: ahmed99' : 'e.g. john99'}
                          className="w-full pl-6 pr-3 py-1.5 text-xs rounded-lg border border-foreground/20 bg-background text-foreground placeholder:text-foreground/30 outline-none focus:border-[hsl(210,100%,65%)] focus:ring-1 focus:ring-[hsl(210,100%,65%,0.3)] transition-all"
                        />
                      </div>
                      {nameError && <p className="text-[10px] text-red-400">{nameError}</p>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        disabled={savingName}
                        onClick={async () => {
                          if (!user?.id) return;
                          if (!nameInput.trim() && !usernameInput.trim()) { setNameError(language === 'ar' ? 'يرجى إدخال اسم أو اسم مستخدم' : 'Please enter a name or username'); return; }
                          setSavingName(true); setNameError('');
                          try {
                            const updates: Record<string, string> = {};
                            if (nameInput.trim()) updates.display_name = nameInput.trim();
                            if (usernameInput.trim()) updates.username = usernameInput.trim();
                            const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
                            if (error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
                              setNameError(language === 'ar' ? 'اسم المستخدم مأخوذ، جرب آخر' : 'Username taken, try another');
                              setSavingName(false); return;
                            }
                            window.dispatchEvent(new CustomEvent('wakti-profile-updated'));
                            setSavingName(false); setEditingName(false);
                          } catch { setSavingName(false); }
                        }}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-[hsl(210,100%,55%)] hover:bg-[hsl(210,100%,50%)] text-white font-medium disabled:opacity-50 active:scale-[0.98] transition-all"
                      >{savingName ? '...' : (language === 'ar' ? 'حفظ' : 'Save')}</button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-foreground/20 text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5 transition-all"
                      >{language === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pitch */}
              <div className="hello-float hello-float-2 rounded-xl px-4 py-3 text-center bg-gradient-to-br from-[hsl(210,100%,65%,0.12)] to-[hsl(280,70%,65%,0.1)] border border-[hsl(210,100%,65%,0.3)] shadow-[0_0_24px_hsl(210,100%,65%,0.15),inset_0_1px_0_hsl(210,100%,65%,0.2)]">
                <p className="text-sm font-semibold text-foreground/95 leading-relaxed">
                  {language === 'ar'
                    ? '🚀 وقتي هو تطبيق الذكاء الاصطناعي الشامل. لن تحتاج إلى أي تطبيق آخر بعد الآن.'
                    : '🚀 Wakti AI is the ultimate Super AI app — one app for everything. You won\'t need any other AI ever again.'}
                </p>
              </div>

              {/* Feature grid */}
              <div className="hello-float hello-float-3 grid grid-cols-2 gap-1.5">
                {featureList.map((feature, i) => {
                  const item = typeof feature === 'string' ? { title: feature } : feature;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-[hsl(210,100%,65%,0.06)] border border-[hsl(210,100%,65%,0.15)] min-w-0 hover:bg-[hsl(210,100%,65%,0.12)] hover:border-[hsl(210,100%,65%,0.35)] hover:shadow-[0_0_10px_hsl(210,100%,65%,0.2)] transition-all duration-200"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(142,76%,55%)] shadow-[0_0_6px_hsl(142,76%,55%)] flex-shrink-0" />
                      <span className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-foreground/90 leading-tight truncate">{item.title}</span>
                        {item.sublabel ? (
                          <span className="text-[9px] text-[hsl(210,100%,65%)] leading-tight">{item.sublabel}</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Promise */}
              <p className="hello-float hello-float-4 text-center text-sm text-[hsl(45,100%,65%)] font-semibold">
                {language === 'ar'
                  ? '✨ نقوم دائماً بتحديث وإضافة ميزات جديدة!'
                  : '✨ We constantly update and add new features!'}
              </p>

              {/* Continue button — the ONLY action on this screen */}
              <div className="hello-float hello-float-5">
                <Button
                  onClick={() => setStep(2)}
                  size="lg"
                  className="continue-btn-glow w-full min-h-[60px] bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] hover:opacity-95 text-white font-bold text-xl tracking-wide active:scale-[0.98] transition-all duration-150 border-0"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {language === 'ar' ? 'استمرار' : 'Continue'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: The Ask (subscribe screen) ── */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Subscribe to Wakti AI</DialogTitle>
              <DialogDescription className="text-base pt-2 font-semibold text-accent-blue">
                {subtitle}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Price */}
              <div className="rounded-lg p-4 text-center space-y-1 border border-[hsl(210,100%,65%,0.2)] bg-[hsl(210,100%,65%,0.05)] shadow-[0_0_20px_hsl(210,100%,65%,0.08)]">
                {(() => {
                  const normalize = (s?: string) => s || '';
                  if (language === 'ar') {
                    const usdRaw = normalize(price.usd).replace('/month', '/شهر').trim();
                    const qarRaw = normalize(price.qar).replace('/month', '/شهر').replace('QAR', 'ر.ق').trim();
                    const usd = usdRaw ? usdRaw.replace('$', '') + ' دولار أمريكي/شهر' : '25 دولار أمريكي/شهر';
                    const qar = qarRaw || 'ر.ق 92/شهر';
                    return (
                      <div className="flex items-center justify-center gap-3">
                        <p className="text-lg text-muted-foreground">{usd}</p>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-2xl font-bold text-primary">{qar}</p>
                      </div>
                    );
                  } else {
                    const qar = normalize(price.qar) || 'QAR 92/month';
                    const usd = normalize(price.usd) || '$25/month';
                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3">
                        <p className="text-xl sm:text-2xl font-bold text-primary">{qar}</p>
                        <span className="hidden sm:inline text-muted-foreground">•</span>
                        <p className="text-xs sm:text-sm text-muted-foreground">{usd} <span className="text-[9px] sm:text-[10px] align-middle opacity-60">USD</span></p>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[hsl(210,100%,55%)] via-[hsl(195,100%,50%)] to-[hsl(175,100%,45%)] hover:from-[hsl(210,100%,60%)] hover:via-[hsl(195,100%,55%)] hover:to-[hsl(175,100%,50%)] text-white font-bold text-lg tracking-wide shadow-[0_0_30px_hsl(200,100%,55%,0.6),0_0_60px_hsl(200,100%,55%,0.3),0_4px_20px_hsl(200,100%,55%,0.4)] hover:shadow-[0_0_40px_hsl(200,100%,55%,0.8),0_0_80px_hsl(200,100%,55%,0.4)] active:scale-[0.98] transition-all duration-150 ring-2 ring-purple-500 ring-offset-1 ring-offset-background"
                  size="lg"
                  style={{minHeight: '56px'}}
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 mr-2" />
                  )}
                  {language === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}
                </Button>

                {showRestorePurchases && (
                  <Button
                    onClick={handleRestore}
                    disabled={restoring}
                    variant="outline"
                    className="w-full border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 text-foreground/80 font-medium transition-all"
                  >
                    {restoring ? (
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {language === 'ar' ? 'استعادة المشتريات' : 'Restore Purchases'}
                  </Button>
                )}

                <button
                  onClick={() => window.open(contactUrl, "_blank", "noopener,noreferrer")}
                  className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 bg-[hsl(142,76%,55%,0.07)] border border-[hsl(142,76%,55%,0.4)] hover:bg-[hsl(142,76%,55%,0.12)] hover:border-[hsl(142,76%,55%,0.7)] hover:shadow-[0_0_16px_hsl(142,76%,55%,0.25)] active:scale-[0.98] transition-all duration-150 group"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(142,76%,55%,0.15)] group-hover:bg-[hsl(142,76%,55%,0.25)] transition-colors">
                    <MessageCircle className="w-4 h-4 text-[hsl(142,76%,60%)]" />
                  </div>
                  <div className={`flex flex-col ${language === 'ar' ? 'items-end' : 'items-start'}`}>
                    <span className="text-sm font-semibold text-[hsl(142,76%,65%)]">{language === 'ar' ? 'تواصل معنا' : 'Contact Us'}</span>
                    <span className="text-xs text-foreground/60">{language === 'ar' ? 'مشكلة في الدفع؟ نحن هنا للمساعدة' : 'Payment issues? We\'re here to help'}</span>
                  </div>
                </button>

                {/* Terms */}
                <div className="text-center pt-1">
                  <a
                    href="https://wakti.qa/privacy-terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    <Shield className="w-3 h-3" />
                    {language === 'ar' ? 'الشروط والخصوصية' : 'Terms & Privacy'}
                  </a>
                </div>
              </div>

              {/* Secondary actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleLogout} variant="ghost" size="sm" className="flex-1">
                  <LogOut className="w-4 h-4 mr-1" />
                  {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { CustomPaywallModal };

export function AppLayout({ children }: AppLayoutProps) {
  // Single instance of useUnreadMessages hook - the only one in the entire app
  const unreadData = useUnreadMessages();
  const { user } = useAuth();

  // Task 3: Identity Mapping — lock RevenueCat receipt to the exact Supabase account
  React.useEffect(() => {
    if (user?.id && user?.email) {
      purchasesLogin(user.id, user.email);
    }
  }, [user?.id, user?.email]);

  const { language } = useTheme();

  // Trial limit bouncer — during 24h trial, show friendly bilingual toast (NOT the full paywall)
  React.useEffect(() => {
    const handleTrialLimit = (e: Event) => {
      const feature = (e as CustomEvent)?.detail?.feature || '';
      const msg = language === 'ar'
        ? `لقد وصلت للحد المجاني لهذه الميزة. اشترك في وكتي للاستمتاع بوصول غير محدود! 🚀`
        : `You've reached the free limit for this feature. Subscribe to Wakti for unlimited access! 🚀`;
      toast.error(msg, { duration: 6000, id: `trial-limit-${feature}` });
    };
    window.addEventListener('wakti-trial-limit-reached', handleTrialLimit);
    return () => window.removeEventListener('wakti-trial-limit-reached', handleTrialLimit);
  }, [language]);

  // Unified notification system - subscribes to notification_history for all notification types
  // including task_due, reminder_due, messages, contacts, RSVPs, etc.
  // This hook automatically shows in-app toasts when new notifications arrive
  useNotificationHistory();
  
  const navigate = useNavigate();
  
  // Set up push notification click handler (Natively/OneSignal)
  // This handles navigation when user taps a push notification
  React.useEffect(() => {
    setupNotificationClickHandler(navigate);
  }, [navigate]);

  const { isMobile } = useIsMobile();
  const { isTablet } = useIsTablet();
  const { isDesktop } = useIsDesktop();
  const location = useLocation();

  // LIGHTWEIGHT CLEANUP - preserves styling
  React.useEffect(() => {
    // Clean up only problematic CSS properties
    document.documentElement.style.removeProperty('--chat-input-height');
    document.documentElement.style.removeProperty('--keyboard-height');
    document.documentElement.style.removeProperty('--visual-viewport-height');
    
    // Remove keyboard-visible class
    document.body.classList.remove('keyboard-visible');
    
    // Ensure bottom space is gone
    document.body.style.paddingBottom = '0';
    document.body.style.marginBottom = '0';
    
    return () => {};
  }, [location.pathname]);
  
  // Detect when we're on dashboard page to apply special styling
  React.useEffect(() => {
    const isDashboardPage = location.pathname === '/' || location.pathname === '/dashboard';
    if (isDashboardPage) {
      document.body.classList.add('dashboard-page');
    } else {
      document.body.classList.remove('dashboard-page');
    }
  }, [location.pathname]);

  // Tag body when on Wakti AI so CSS can scope a single scroller
  React.useEffect(() => {
    const isWaktiAIPage = location.pathname === '/wakti-ai';
    if (isWaktiAIPage) {
      document.body.classList.add('wakti-ai-page');
    } else {
      document.body.classList.remove('wakti-ai-page');
    }
  }, [location.pathname]);

  // Tag body when on project detail page to lock outer scrolling
  React.useEffect(() => {
    const isProjectDetailPage = location.pathname.startsWith('/projects/') && location.pathname.length > 11;
    if (isProjectDetailPage) {
      document.body.classList.add('project-detail-page');
    } else {
      document.body.classList.remove('project-detail-page');
    }
    return () => {
      document.body.classList.remove('project-detail-page');
    };
  }, [location.pathname]);

  React.useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.removeAttribute('data-aria-hidden');
    document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => el.removeAttribute('data-aria-hidden'));
  }, [location.pathname]);

  // Content: use children if provided (legacy), otherwise use Outlet for nested routes
  const content = children || <Outlet />;

  if (isMobile) {
    return (
      <UnreadContext.Provider value={unreadData}>
        {/* When paywall is open, disable header interactions and keep it under the modal */}
        <style>
          {`
            body.paywall-open .app-header-fixed{pointer-events:none !important; z-index:0 !important;}
          `}
        </style>
        <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
          <div className="h-[100dvh] bg-background app-layout-mobile overflow-x-hidden flex flex-col">
            <AppHeader unreadTotal={unreadData.unreadTotal} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden app-main-scroll">
              {content}
            </main>
            <PresenceBeacon />
          </div>
        </ProtectedRoute>
      </UnreadContext.Provider>
    );
  }

  if (isTablet) {
    return (
      <UnreadContext.Provider value={unreadData}>
        <style>
          {`body.paywall-open [data-radix-popper-content-wrapper]{z-index:1200 !important;}`}
        </style>
        <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
          <PresenceBeacon />
          <TabletLayout>{content}</TabletLayout>
        </ProtectedRoute>
      </UnreadContext.Provider>
    );
  }

  // Desktop
  return (
    <UnreadContext.Provider value={unreadData}>
      <style>
        {`
          body.paywall-open .app-header-fixed{pointer-events:none !important; z-index:0 !important;}
        `}
      </style>
      <ProtectedRoute CustomPaywallModal={CustomPaywallModal}>
        <PresenceBeacon />
        <DesktopLayout>{content}</DesktopLayout>
      </ProtectedRoute>
    </UnreadContext.Provider>
  );
}
