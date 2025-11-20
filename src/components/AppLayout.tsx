import React, { createContext, useContext, useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DesktopLayout } from "@/components/layouts/DesktopLayout";
import { TabletLayout } from "@/components/layouts/TabletLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useIsMobile, useIsTablet, useIsDesktop } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { purchasePackage, restorePurchases, getOfferings } from "@/integrations/natively/purchasesBridge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, LogOut, Home, Shield } from "lucide-react";
import { Logo3D } from "@/components/Logo3D";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
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
}

function CustomPaywallModal({ open, onOpenChange }: CustomPaywallModalProps) {
  const { language, setLanguage } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [price, setPrice] = useState<{ qar?: string; usd?: string }>({});

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
    getOfferings((resp) => {
      if (resp?.status === 'SUCCESS' && resp?.offerings?.current) {
        const pkg = resp.offerings.current.availablePackages?.find(
          (p: any) => p.identifier === '$rc_monthly'
        );
        if (pkg?.product) {
          setPrice({
            qar: pkg.product.priceString || 'QAR 95/month',
            usd: pkg.product.priceUSD || '$25/month',
          });
        }
      }
    });
  }, [open]);

  const handleSubscribe = () => {
    setLoading(true);
    purchasePackage('$rc_monthly', (resp) => {
      setLoading(false);
      if (resp?.status === 'SUCCESS' && resp?.message === 'purchased') {
        toast.success(language === 'ar' ? 'تم الاشتراك بنجاح!' : 'Subscription successful!');
        onOpenChange(false);
      } else if (resp?.status === 'ERROR') {
        toast.error(resp?.message || (language === 'ar' ? 'فشل الاشتراك' : 'Purchase failed'));
      }
    });
  };

  const handleRestore = () => {
    setRestoring(true);
    restorePurchases((resp) => {
      setRestoring(false);
      if (resp?.status === 'SUCCESS' && resp?.message === 'restored') {
        toast.success(language === 'ar' ? 'تم استعادة المشتريات!' : 'Purchases restored!');
        onOpenChange(false);
      } else {
        toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
      }
    });
  };

  const handleLogout = async () => {
    await signOut();
    onOpenChange(false);
    navigate('/login');
  };

  const handleHome = () => {
    onOpenChange(false);
    navigate('/');
  };

  const copy = {
    en: {
      title: 'WAKTI AI',
      subtitle: 'Your 30-minute trial has ended. Subscribe to continue.',
      features: [
        'WAKTI AI',
        'WAKTI AI Search',
        'Image Generator',
        'Tasks & Reminders',
        'Maw3d Events',
        'Tasjeel Voice Recorder',
        'Contacts & Messaging',
        'Vitality',
        'WAKTI Journal',
        'Smart Text Generator',
        'AI Games',
        'Voice Cloning',
        'Music Generation',
        'Voice Translation',
      ],
      trial: '3-day free trial, then',
      subscribe: 'Start Free Trial',
      restore: 'Restore Purchases',
      logout: 'Logout',
      home: 'Back to Home',
      terms: 'Terms & Privacy',
      en: 'English',
      ar: 'العربية'
    },
    ar: {
      title: 'WAKTI AI',
      subtitle: 'انتهت فترة التجربة المجانية. اشترك للمتابعة.',
      features: [
        'وقتي AI',
        'بحث وقتي AI',
        'مولد الصور',
        'المهام والتذكيرات',
        'مواعيد Maw3d',
        'تسجيل (Tasjeel) مسجل الصوت',
        'جهات الاتصال والرسائل',
        'الحيوية',
        'دفتر يوميات وقطي',
        'مولد النص الذكي',
        'ألعاب الذكاء الاصطناعي',
        'استنساخ الصوت',
        'إنشاء الموسيقى',
        'ترجمة الصوت',
      ],
      trial: 'تجربة مجانية 3 أيام، ثم',
      subscribe: 'ابدأ التجربة المجانية',
      restore: 'استعادة المشتريات',
      logout: 'تسجيل الخروج',
      home: 'العودة للرئيسية',
      terms: 'الشروط والخصوصية',
      en: 'English',
      ar: 'العربية'
    },
  };

  const txt = copy[language as 'en' | 'ar'] || copy.en;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[85vw] max-w-[85vw] sm:w-full sm:max-w-md bg-gradient-to-br from-background via-background to-accent/5 border-accent/20 max-h-[85vh] overflow-y-auto rounded-xl"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        hideCloseButton
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <Logo3D size="sm" className="w-8 h-8" />
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
        </div>
        <DialogHeader>
          <DialogDescription className="text-base pt-2 font-semibold text-accent-blue">
            {txt.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features */}
          <div className="grid grid-cols-2 gap-2">
            {txt.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md bg-accent/5 px-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="bg-accent/10 rounded-lg p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">{txt.trial}</p>
            {(() => {
              const normalize = (s?: string) => s || '';
              if (language === 'ar') {
                // Arabic: show USD as '25 دولار أمريكي/شهر', QAR as 'ر.ق 95/شهر'
                const usdRaw = normalize(price.usd).replace('/month', '/شهر').trim();
                const qarRaw = normalize(price.qar).replace('/month', '/شهر').replace('QAR', 'ر.ق').trim();
                const usd = usdRaw ? usdRaw.replace('$', '') + ' دولار أمريكي/شهر' : '25 دولار أمريكي/شهر';
                const qar = qarRaw || 'ر.ق 95/شهر';
                return (
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-lg text-muted-foreground">{usd}</p>
                    <span className="text-muted-foreground">•</span>
                    <p className="text-2xl font-bold text-primary">{qar}</p>
                  </div>
                );
              } else {
                // English: keep QAR primary, add small 'USD' tag
                const qar = normalize(price.qar) || 'QAR 95/month';
                const usd = normalize(price.usd) || '$25/month';
                return (
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-2xl font-bold text-primary">{qar}</p>
                    <span className="text-muted-foreground">•</span>
                    <p className="text-lg text-muted-foreground">{usd} <span className="text-xs align-middle opacity-70">USD</span></p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={() => { onOpenChange(false); navigate('/account?tab=billing'); }}
              variant="outline"
              className="w-full"
            >
              {language === 'ar' ? 'الفوترة' : 'Billing'}
            </Button>

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent-purple to-accent-pink hover:opacity-90 text-white font-semibold"
              size="lg"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {txt.subscribe}
            </Button>

            <Button
              onClick={handleRestore}
              disabled={restoring}
              variant="outline"
              className="w-full"
            >
              {restoring ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {txt.restore}
            </Button>

            {/* Terms */}
            <div className="text-center pt-1">
              <a
                href="https://wakti.qa/privacy-terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              >
                <Shield className="w-3 h-3" />
                {txt.terms}
              </a>
            </div>
          </div>

          {/* Secondary actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleHome} variant="ghost" size="sm" className="flex-1">
              <Home className="w-4 h-4 mr-1" />
              {txt.home}
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="flex-1">
              <LogOut className="w-4 h-4 mr-1" />
              {txt.logout}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { CustomPaywallModal };

function WelcomeTrialPopup() {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverStartAt, setServerStartAt] = useState<string | null>(null);
  const [minutesOffer, setMinutesOffer] = useState<number>(30);
  const { profile, isSubscribed, isGracePeriod, isAccessExpired } = useUserProfile();
  const location = useLocation();
  const allowedPaths = ['/', '/dashboard', '/wakti-ai'];
  const isAllowedRoute = allowedPaths.includes(location.pathname);

  useEffect(() => {
    if (!user?.id) return;

    // Only show trial popup on specific core routes (e.g. dashboard and WAKTI AI)
    if (!isAllowedRoute) {
      setShowPopup(false);
      return;
    }

    // If user is subscribed or access is fully expired, never show the trial popup
    if (isSubscribed || isAccessExpired) {
      setShowPopup(false);
      return;
    }

    const startAt: string | null = profile?.free_access_start_at ?? null;
    setServerStartAt(startAt);

    // Compute minutes to show in popup based on current start time
    if (startAt == null) {
      setMinutesOffer(30);
    } else {
      const startMs = Date.parse(startAt);
      const elapsedMin = Math.floor((Date.now() - startMs) / 60000);
      const remaining = Math.max(0, 30 - elapsedMin);
      setMinutesOffer(remaining || 30);
    }

    const lsKey = `trial_popup_seen_for_start_at:${user.id}`;
    const lastSeen = localStorage.getItem(lsKey);

    // Only show popup while in grace period and user hasn't acknowledged this start_at yet
    if (isGracePeriod && (startAt === null || lastSeen !== (startAt || ""))) {
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  }, [user?.id, profile?.free_access_start_at, isSubscribed, isGracePeriod, isAccessExpired, isAllowedRoute]);

  const handleStartTrial = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const lsKey = `trial_popup_seen_for_start_at:${user.id}`;
      if (serverStartAt == null) {
        // Start the trial now
        const nowIso = new Date().toISOString();
        await supabase
          .from('profiles')
          .update({ free_access_start_at: nowIso })
          .eq('id', user.id);
        localStorage.setItem(lsKey, nowIso);
      } else {
        // Trial already set (e.g., admin reset). Just acknowledge so popup won't reappear.
        localStorage.setItem(lsKey, serverStartAt);
      }
      setShowPopup(false);
    } catch (error) {
      console.error('Error starting trial:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAllowedRoute) return null;

  return (
    <Dialog open={showPopup} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Wakti AI! 🎉</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Enjoy <strong>{minutesOffer} minutes of full access</strong> to explore all features.
            After that, subscribe to continue using Wakti AI.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-4">
          <Button onClick={handleStartTrial} disabled={loading}>
            {loading ? 'Starting...' : 'OK, Start Trial'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  // Single instance of useUnreadMessages hook - the only one in the entire app
  const unreadData = useUnreadMessages();

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

  React.useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.removeAttribute('data-aria-hidden');
    document.querySelectorAll('[data-aria-hidden="true"]').forEach((el) => el.removeAttribute('data-aria-hidden'));
  }, [location.pathname]);

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
          <WelcomeTrialPopup />
          <div className="min-h-screen bg-background">
            <div className="relative">
              <AppHeader unreadTotal={unreadData.unreadTotal} />
            </div>
            <main>
              {children}
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
          <WelcomeTrialPopup />
          <PresenceBeacon />
          <TabletLayout>{children}</TabletLayout>
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
        <WelcomeTrialPopup />
        <PresenceBeacon />
        <DesktopLayout>{children}</DesktopLayout>
      </ProtectedRoute>
    </UnreadContext.Provider>
  );
}
