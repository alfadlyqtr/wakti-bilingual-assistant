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

export type PlanType = 'monthly' | 'yearly';
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
  const title = isAr ? (<><span>اشتراك </span><span dir="ltr">Wakti AI</span></>) : "Wakti AI Subscription";
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
    <div className="p-4 sm:p-5 md:p-8 text-center space-y-4 md:space-y-5 pb-[env(safe-area-inset-bottom,0px)]" dir={isAr ? "rtl" : "ltr"}>
      <div className={`absolute top-2 md:top-3 left-2 md:left-3`}>
        <ThemeLanguageToggle />
      </div>
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight text-enhanced-heading">{title}</h2>
      <p className="text-sm md:text-base leading-relaxed text-muted-foreground max-w-md mx-auto break-words px-1">{body1}</p>

      <Button
        onClick={handleClick}
        disabled={isLoading}
        type="button"
        className="w-full rounded-full py-3 md:py-4 shadow-sm border border-primary text-primary bg-background hover:bg-primary/5"
      >
        <span className={`flex items-center justify-center gap-2 whitespace-normal break-words text-center max-w-full leading-tight px-1`}>
          <span className="text-sm sm:text-base font-semibold">{subscribeLabel}</span>
          <span className="opacity-70">•</span>
          <span className="text-xs sm:text-sm">{isAr ? (<><span dir="rtl">95 ر.ق/شهر</span><span dir="ltr"> · ~$26 USD</span></>) : price}</span>
        </span>
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 pt-2 md:pt-3">
        <a href="/" className="inline-flex items-center justify-center rounded-full border border-primary text-primary bg-background hover:bg-primary/5 h-10 px-4 text-sm font-medium">{isAr ? "العودة للصفحة الرئيسية" : "Back to Home"}</a>
        <Button variant="destructive" type="button" onClick={() => onLogout()} className="rounded-full">{isAr ? "تسجيل الخروج" : "Log out"}</Button>
      </div>
      <div className="pt-2">
        <Button variant="ghost" type="button" onClick={() => onRestore()} className="text-primary hover:underline h-auto px-2 py-1">{isAr ? "استعادة المشتريات" : "Restore Purchases"}</Button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <p className="text-xs text-muted-foreground pt-1" dir={isAr ? "rtl" : "ltr"}>
        {isAr
          ? "سيتم خصم الرسوم من حساب Apple ID الخاص بك. يتم التجديد تلقائيًا ما لم يتم الإلغاء قبل 24 ساعة على الأقل من نهاية الفترة."
          : "Payment is charged to your Apple ID. Auto-renews unless canceled at least 24 hours before the end of the period."}
      </p>
    </div>
  );
}

export function FawranPaymentOverlay({ userEmail, onClose }: FawranPaymentOverlayProps) {
  const auth: any = useAuth() as any;
  const user = auth?.user;
  const { language } = useTheme();
  const isAr = language === "ar";

  const handleApplePay = async () => {
    if (!user || !(user as any).id) {
      throw new Error("You must be logged in to make a purchase.");
    }
    if (typeof window.makeInAppPurchase !== "function") {
      throw new Error("Payment is only available inside the Wakti iOS app. Please open the app to subscribe.");
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

  // Hide overlay when logged out
  if (!user) return null;

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
        <ApplePayUI
          onSubscribeClick={handleApplePay}
          onClose={onClose}
          onRestore={handleRestore}
          onBackHome={handleBackHome}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
