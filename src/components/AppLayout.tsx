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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, LogOut, Home, Shield, Clock } from "lucide-react";
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
  const { signOut, user } = useAuth();
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
            usd: pkg.product.priceUSD || '$24.99/month',
          });
        }
      }
    });
  }, [open]);

  const handleSubscribe = async () => {
    setLoading(true);
    purchasePackage('$rc_monthly', async (resp: any) => {
      console.log('[Purchase] Response:', resp);
      
      if (resp?.status === 'SUCCESS' && resp?.message === 'purchased') {
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
        onOpenChange(false);
        window.location.reload(); // Refresh to update UI
      } else if (resp?.status === 'ERROR') {
        toast.error(resp?.message || (language === 'ar' ? 'فشل الاشتراك' : 'Purchase failed'));
      }
      setLoading(false);
    });
  };

  const handleRestore = () => {
    setRestoring(true);
    
    // Call native restore - Natively SDK talks to Apple/RevenueCat
    // Callback receives: { status: 'SUCCESS' | 'FAILED', customerId, error }
    restorePurchases((resp: any) => {
      console.log('[Restore] Native SDK response:', resp);
      
      try {
        // If native restore succeeded
        if (resp?.status === 'SUCCESS') {
          console.log('[Restore] Native restore succeeded!');
          
          // Sync with backend to update DB (fire and forget)
          if (user?.id) {
            supabase.functions.invoke('check-subscription', {
              body: { userId: user.id }
            }).catch(err => console.error('[Restore] Backend sync failed:', err));
          }
          
          toast.success(language === 'ar' ? 'تم استعادة المشتريات!' : 'Purchases restored!');
          onOpenChange(false);
          
          // Small delay before reload to show toast
          setTimeout(() => window.location.reload(), 500);
          return;
        }
        
        // Native restore failed or found nothing
        console.log('[Restore] Native restore status:', resp?.status, 'Error:', resp?.error);
        
        // Try backend check as fallback (for cross-device restore via RevenueCat API)
        if (user?.id) {
          supabase.functions.invoke('check-subscription', {
            body: { userId: user.id }
          }).then(({ data }) => {
            if (data?.isSubscribed) {
              toast.success(language === 'ar' ? 'تم استعادة المشتريات!' : 'Purchases restored!');
              onOpenChange(false);
              setTimeout(() => window.location.reload(), 500);
            } else {
              toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
              setRestoring(false);
            }
          }).catch(err => {
            console.error('[Restore] Backend fallback failed:', err);
            toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
            setRestoring(false);
          });
        } else {
          toast.error(language === 'ar' ? 'لم يتم العثور على مشتريات' : 'No purchases found');
          setRestoring(false);
        }
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
        className="w-[95vw] max-w-[95vw] sm:w-[90vw] sm:max-w-[500px] bg-gradient-to-br from-background via-background to-accent/5 border-accent/20 max-h-[90vh] overflow-y-auto rounded-xl"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        hideCloseButton
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
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
                const usd = normalize(price.usd) || '$24.99/month';
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
              {language === 'ar' ? 'الحساب / الفوترة' : 'Account / Billing'}
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

// WelcomeTrialPopup - shown ONCE per user lifetime to inform them of 30-min trial
// ✅ SOLID SOLUTION: Database is the ONLY source of truth - no localStorage
function WelcomeTrialPopup() {
  const { profile, loading, isSubscribed, hasSeenTrialPopup, hasTrialStarted, refetch } = useUserProfile();
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const allowedRoutes = ['/', '/dashboard', '/wakti-ai'];
  const shouldShowPopup = allowedRoutes.includes(location.pathname);

  // ✅ SOLID DATABASE-ONLY LOGIC
  // Show popup ONLY if ALL conditions are met:
  // 1. Profile is LOADED (not loading, not null)
  // 2. User is logged in
  // 3. User is NOT subscribed
  // 4. User is on allowed route
  // 5. trial_popup_shown === false (from DATABASE)
  // 6. free_access_start_at === null (trial NOT started - from DATABASE)
  useEffect(() => {
    // ✅ CRITICAL: Wait for profile to load - database is the source of truth
    if (loading || !profile) {
      return; // Don't evaluate until profile is fully loaded
    }

    const shouldShow = (
      user &&
      !isSubscribed &&
      shouldShowPopup &&
      !hasSeenTrialPopup &&    // DB: trial_popup_shown = false
      !hasTrialStarted         // DB: free_access_start_at = null (double safety)
    );

    setIsOpen(shouldShow);
  }, [loading, profile, user, isSubscribed, shouldShowPopup, hasSeenTrialPopup, hasTrialStarted]);

  const handleStartTrial = async () => {
    if (!user?.id) return;
    
    setIsStartingTrial(true);
    
    // ✅ Close popup immediately (optimistic UI)
    setIsOpen(false);
    
    try {
      // Update BOTH fields in a single atomic database update
      const { error } = await supabase
        .from('profiles')
        .update({
          free_access_start_at: new Date().toISOString(),
          trial_popup_shown: true
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error starting trial:', error);
        toast.error('Failed to start trial. Please try again.');
        // Re-open popup on error so user can retry
        setIsOpen(true);
        return;
      }

      // Refetch profile to get updated data from database
      await refetch();
      
      toast.success('Your 30-minute trial has started!');
    } catch (error) {
      console.error('Error starting trial:', error);
      toast.error('Failed to start trial. Please try again.');
      // Re-open popup on error so user can retry
      setIsOpen(true);
    } finally {
      setIsStartingTrial(false);
    }
  };

  if (!shouldShowPopup) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isStartingTrial && setIsOpen(open)}>
      <DialogContent 
        className="sm:max-w-md bg-background border-border"
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Welcome to Wakti AI! 🎉
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-center text-muted-foreground">
            Enjoy <strong>30 minutes of full access</strong> to explore all features. After that, subscribe to continue using Wakti AI.
          </p>
          <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">
              30 minute free trial
            </span>
          </div>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button 
            onClick={handleStartTrial}
            disabled={isStartingTrial}
            className="w-full sm:w-auto"
          >
            {isStartingTrial ? 'Starting...' : 'OK, Start Trial'}
          </Button>
        </DialogFooter>
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
