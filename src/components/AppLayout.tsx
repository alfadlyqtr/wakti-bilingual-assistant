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
import { purchasePackage, restorePurchases, getOfferings } from "@/integrations/natively/purchasesBridge";
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
import { Sparkles, RefreshCw, LogOut, Home, Shield, Clock, MessageCircle } from "lucide-react";
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
}

function CustomPaywallModal({ open, onOpenChange }: CustomPaywallModalProps) {
  const { language, setLanguage } = useTheme();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [price, setPrice] = useState<{ qar?: string; usd?: string }>({});
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const contactUrl = "https://wa.me/97433994166";

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
    
    purchasePackage('$rc_monthly', async (resp: any) => {
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
        
        // Clear cache and force ProtectedRoute refresh
        if (user?.id) {
          try {
            localStorage.removeItem(`wakti_sub_status_${user.id}`);
            window.dispatchEvent(new CustomEvent('wakti-subscription-updated'));
          } catch {}
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

  const handleHome = () => {
    onOpenChange(false);
    navigate('/');
  };

  const copy = {
    en: {
      title: 'WAKTI AI',
      subtitle: 'Your 4-day trial has ended. Subscribe to continue.',
      features: [
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
      trial: '',
      subscribe: 'Subscribe Now',
      restore: 'Restore Purchases',
      contact: 'Contact Us',
      contactSub: 'Payment issues? We\'re here to help',
      logout: 'Logout',
      home: 'Back to Home',
      terms: 'Terms & Privacy',
      en: 'English',
      ar: 'العربية'
    },
    ar: {
      title: 'WAKTI AI',
      subtitle: 'انتهت فترة التجربة المجانية (4 أيام). اشترك للمتابعة.',
      features: [
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
      ],
      trial: '',
      subscribe: 'اشترك الآن',
      restore: 'استعادة المشتريات',
      contact: 'تواصل معنا',
      contactSub: 'مشكلة في الدفع؟ نحن هنا للمساعدة',
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
          <DialogTitle className="sr-only">Subscribe to Wakti AI</DialogTitle>
          <DialogDescription className="text-base pt-2 font-semibold text-accent-blue">
            {txt.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features - Mobile optimized */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-1.5">
            {txt.features.map((feature, i) => {
              const item = typeof feature === 'string' ? { title: feature } : feature;
              return (
                <div key={i} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 bg-[hsl(210,100%,65%,0.06)] border border-[hsl(210,100%,65%,0.15)] min-w-0">
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

          {/* Price */}
          <div className="rounded-lg p-4 text-center space-y-1 border border-[hsl(210,100%,65%,0.2)] bg-[hsl(210,100%,65%,0.05)] shadow-[0_0_20px_hsl(210,100%,65%,0.08)]">
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
              onClick={() => { onOpenChange(false); navigate('/account?tab=billing'); }}
              variant="outline"
              className="w-full border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 text-foreground/80 font-medium transition-all"
            >
              {language === 'ar' ? 'الحساب / الفوترة' : 'Account / Billing'}
            </Button>

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
              {txt.subscribe}
            </Button>

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
              {txt.restore}
            </Button>

            <button
              onClick={() => window.open(contactUrl, "_blank", "noopener,noreferrer")}
              className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 bg-[hsl(142,76%,55%,0.07)] border border-[hsl(142,76%,55%,0.4)] hover:bg-[hsl(142,76%,55%,0.12)] hover:border-[hsl(142,76%,55%,0.7)] hover:shadow-[0_0_16px_hsl(142,76%,55%,0.25)] active:scale-[0.98] transition-all duration-150 group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(142,76%,55%,0.15)] group-hover:bg-[hsl(142,76%,55%,0.25)] transition-colors">
                <MessageCircle className="w-4 h-4 text-[hsl(142,76%,60%)]" />
              </div>
              <div className={`flex flex-col ${language === 'ar' ? 'items-end' : 'items-start'}`}>
                <span className="text-sm font-semibold text-[hsl(142,76%,65%)]">{txt.contact}</span>
                <span className="text-xs text-foreground/60">{txt.contactSub}</span>
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
      
      toast.success('Your 4-day free trial has started!');
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
            Enjoy <strong>4 days of full access</strong> to explore all features. After that, subscribe to continue using Wakti AI.
          </p>
          <div className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">
              4-day free trial
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
          <WelcomeTrialPopup />
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
          <WelcomeTrialPopup />
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
        <WelcomeTrialPopup />
        <PresenceBeacon />
        <DesktopLayout>{content}</DesktopLayout>
      </ProtectedRoute>
    </UnreadContext.Provider>
  );
}
