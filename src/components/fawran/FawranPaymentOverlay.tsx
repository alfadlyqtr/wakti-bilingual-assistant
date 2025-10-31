/*
Apple-only IAP overlay. Shows only to users without an active subscription and only inside the packaged app (when webtoapp helper is present).
Requires in index.html head:
<script src="https://webtoapp.design/static/js/app-helper.js"></script>
*/

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    makeInAppPurchase?: (
      productId: string,
      consumable: boolean,
      userIdentifier: string
    ) => Promise<{ status: "completed" | "canceled" | "failed" }>;
  }
}

interface FawranPaymentOverlayProps {
  userEmail: string;
  onClose: () => void;
}

// No logo visuals by request

function ApplePayUI({
  onSubscribeClick,
  onClose,
  onRestore,
  onBackHome,
  onLogout,
}: {
  onSubscribeClick: () => Promise<void>;
  onClose: () => void;
  onRestore: () => Promise<void> | void;
  onBackHome: () => void;
  onLogout: () => Promise<void> | void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { language } = useTheme();
  const isAr = language === "ar";
  const title = isAr ? "اشتراك Wakti AI" : "Wakti AI Subscription";
  const body1 = isAr
    ? "اشترك بأمان عبر Apple للوصول إلى جميع أدوات واكتي (12 أداة). يمكنك الإلغاء في أي وقت من إعدادات Apple ID."
    : "Subscribe securely with Apple to unlock all 12 Wakti AI tools. You can cancel anytime in your Apple ID settings.";
  const subscribeLabel = isAr ? "اشترك عبر Apple" : "Subscribe with Apple";
  const price = isAr ? "95 ر.ق/شهر · ~$26 USD" : "95 QAR/month · ~$26 USD";

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onSubscribeClick();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "An unknown error occurred. Please try again.");
    }
    setIsLoading(false);
  };

  // restore/back/logout come from parent via props

  return (
    <div className="p-8 text-center space-y-5" dir={isAr ? "rtl" : "ltr"}>
      <div className="absolute top-3 left-3">
        <ThemeLanguageToggle />
      </div>
      <h2 className="text-2xl font-bold text-enhanced-heading">{title}</h2>
      <p className="text-muted-foreground max-w-md mx-auto">{body1}</p>

      <Button
        onClick={handleClick}
        disabled={isLoading}
        type="button"
        className="w-full rounded-full py-4 shadow-sm border border-primary text-primary bg-background hover:bg-primary/5"
      >
        <span className={`flex items-center justify-center gap-2 ${isAr ? "flex-row-reverse" : ""}`}>
          <span className="text-base font-semibold">{subscribeLabel}</span>
          <span className="opacity-70">•</span>
          <span className="text-sm">{price}</span>
        </span>
      </Button>

      <div className="grid grid-cols-2 gap-3 pt-3">
        <a href="/" className="inline-flex items-center justify-center rounded-full border border-primary text-primary bg-background hover:bg-primary/5 h-10 px-4 text-sm font-medium">Back to Home</a>
        <Button variant="destructive" type="button" onClick={() => onLogout()} className="rounded-full">Log out</Button>
      </div>
      <div className="pt-2">
        <Button variant="ghost" type="button" onClick={() => onRestore()} className="text-primary hover:underline h-auto px-2 py-1">Restore Purchases</Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <p className="text-xs text-muted-foreground pt-1">
        Payment is charged to your Apple ID. Auto-renews unless canceled at least 24 hours before the end of the period.
      </p>
    </div>
  );
}

export function FawranPaymentOverlay({ userEmail, onClose }: FawranPaymentOverlayProps) {
  const auth: any = useAuth() as any;
  const user = auth?.user;
  const hasActiveSubscription: boolean = !!auth?.hasActiveSubscription;
  const [isReady, setIsReady] = useState(false);
  const { language } = useTheme();
  const isAr = language === "ar";

  useEffect(() => {
    const ready = typeof window.makeInAppPurchase === "function";
    setIsReady(ready);
  }, []);

  const handleApplePay = async () => {
    if (!user || !(user as any).id) {
      throw new Error("You must be logged in to make a purchase.");
    }
    if (!window.makeInAppPurchase) {
      throw new Error("Purchase function not available. Please update your app.");
    }
    const productId = "wakti_monthly_95qar";
    const consumable = false;
    const userIdentifier = (user as any).id;
    const result = await window.makeInAppPurchase(productId, consumable, userIdentifier);
    if (result.status === "completed") {
      alert("Purchase successful! Your subscription is now active.");
      onClose();
    } else if (result.status === "canceled") {
      console.log("User canceled Apple Pay.");
    } else {
      throw new Error("Purchase failed. Please try again or contact support.");
    }
  };

  // Parent-scoped helpers used by ApplePayUI and fallback
  const handleRestore = async () => {
    if (typeof (window as any).restorePurchases === "function") {
      try {
        await (window as any).restorePurchases();
        onClose();
      } catch (e) {
        console.error("Restore purchases failed", e);
        alert("Could not restore purchases. Please try again from the iOS app's Account settings.");
      }
    } else {
      alert("Restore Purchases is available inside the iOS app from your Account settings.");
    }
  };

  const handleBackHome = () => {
    window.location.href = "/";
  };

  const handleLogout = async () => {
    try {
      if ((auth as any)?.signOut) await (auth as any).signOut();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      // Extra belt-and-suspenders: ensure Supabase is logged out globally
      try { await (supabase as any)?.auth?.signOut?.({ scope: 'global' as any }); } catch {}
      // Purge any persisted auth state that could auto-restore a session
      try {
        for (const store of [localStorage, sessionStorage]) {
          try {
            const keys: string[] = [];
            for (let i = 0; i < store.length; i++) {
              const k = store.key(i);
              if (!k) continue;
              if (k.startsWith('sb-') || k.startsWith('wakti-auth')) keys.push(k);
            }
            keys.forEach((k) => store.removeItem(k));
          } catch {}
        }
      } catch {}
      // Hard navigate to login to avoid any guarded routes restoring state
      window.location.replace("/login?ts=" + Date.now());
    }
  };

  // Hide overlay when logged out, or when already subscribed
  if (!user || hasActiveSubscription) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </Button>
        {/* If helper isn't available (web), keep the overlay visible but show a disabled Apple Pay button */}
        {isReady ? (
          <ApplePayUI
            onSubscribeClick={handleApplePay}
            onClose={onClose}
            onRestore={handleRestore}
            onBackHome={handleBackHome}
            onLogout={handleLogout}
          />
        ) : (
          <div className="p-8 text-center space-y-5" dir={isAr ? "rtl" : "ltr"}>
            <div className="absolute top-3 left-3"><ThemeLanguageToggle /></div>
            <h2 className="text-2xl font-bold text-enhanced-heading">{isAr ? "اشتراك Wakti AI" : "Wakti AI Subscription"}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {isAr
                ? "الدفع داخل التطبيق متاح فقط على أجهزة iOS. افتح تطبيق واكتي على iPhone أو iPad للاشتراك."
                : "Apple In‑App Purchase is available inside the iOS app. Open Wakti on your iPhone or iPad to subscribe."}
            </p>
            <Button disabled className="w-full rounded-full py-4 opacity-60 cursor-not-allowed border border-primary text-primary bg-background">
              <span className={`flex items-center justify-center gap-2 ${isAr ? "flex-row-reverse" : ""}`}>
                <span className="text-base font-semibold">{isAr ? "اشترك عبر Apple" : "Subscribe with Apple"}</span>
                <span className="opacity-70">•</span>
                <span className="text-sm">{isAr ? "95 ر.ق/شهر · ~$26 USD" : "95 QAR/month · ~$26 USD"}</span>
              </span>
            </Button>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <a href="/" className="inline-flex items-center justify-center rounded-full border border-primary text-primary bg-background hover:bg-primary/5 h-10 px-4 text-sm font-medium">{isAr ? "العودة للصفحة الرئيسية" : "Back to Home"}</a>
              <Button variant="destructive" type="button" onClick={handleLogout} className="rounded-full">{isAr ? "تسجيل الخروج" : "Log out"}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
