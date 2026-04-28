import React, { useEffect, useState } from "react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { onEvent } from "@/utils/eventBus";

type TrialOverlayMode = 'blocked' | 'finished';
type TrialReason = 'feature_locked' | 'limit_reached' | 'trial_expired';

interface OverlayState {
  open: boolean;
  mode: TrialOverlayMode;
  reason: TrialReason;
  consumed?: number;
  limit?: number;
}

interface TrialGateOverlayProps {
  featureKey: string;
  limit: number;
  featureLabel?: { en: string; ar: string };
}

const TrialGateOverlay: React.FC<TrialGateOverlayProps> = ({ featureKey, limit, featureLabel }) => {
  const [overlayState, setOverlayState] = useState<OverlayState>({
    open: false,
    mode: 'blocked',
    reason: 'limit_reached',
  });
  const { language } = useTheme();
  const { profile: cachedProfile, isSubscribed, isAdminGifted, hasTrialStarted } = useUserProfile();
  const navigate = useNavigate();

  const openBlocked = (reason: TrialReason, consumed?: number, nextLimit?: number) => {
    setOverlayState({
      open: true,
      mode: 'blocked',
      reason,
      consumed,
      limit: nextLimit ?? limit,
    });
  };

  const openFinished = (consumed?: number, nextLimit?: number) => {
    setOverlayState({
      open: true,
      mode: 'finished',
      reason: 'limit_reached',
      consumed,
      limit: nextLimit ?? limit,
    });
  };

  useEffect(() => {
    // Reset when featureKey/limit changes (e.g. switching submodes)
    setOverlayState({ open: false, mode: 'blocked', reason: 'limit_reached' });

    // Empty featureKey means OPEN / unlimited — never block
    if (!featureKey) return;

    // Paid / gifted / no trial started — never block
    if (isSubscribed || isAdminGifted || !hasTrialStarted) return;

    // Check cached trial_usage
    if (cachedProfile) {
      const usage = (cachedProfile.trial_usage as Record<string, number>) ?? {};
      const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
      if (limit <= 0) {
        openBlocked('feature_locked', current, limit);
      } else if (current >= limit) {
        openBlocked('limit_reached', current, limit);
      }
    }

    const offLimitReached = onEvent('wakti-trial-limit-reached', ({ feature, reason, consumed, limit: eventLimit }) => {
      if (feature === featureKey) {
        openBlocked(reason || 'limit_reached', consumed, eventLimit);
      }
    });

    const offQuotaFinished = onEvent('wakti-trial-quota-finished', ({ feature, consumed, limit: eventLimit }) => {
      if (feature === featureKey) {
        openFinished(consumed, eventLimit);
      }
    });

    return () => {
      offLimitReached();
      offQuotaFinished();
    };
  }, [featureKey, limit, isSubscribed, isAdminGifted, hasTrialStarted, cachedProfile]);

  if (!overlayState.open) return null;

  const labelEn = featureLabel?.en || 'This Feature';
  const labelAr = featureLabel?.ar || 'هذه الميزة';
  const isArabic = language === 'ar';
  const title = (() => {
    if (overlayState.mode === 'finished') {
      return isArabic ? `اكتملت حصتك المجانية — ${labelAr}` : `Free Quota Finished — ${labelEn}`;
    }

    if (overlayState.reason === 'feature_locked') {
      return isArabic ? `هذه الميزة غير مشمولة في التجربة — ${labelAr}` : `Not Included In Trial — ${labelEn}`;
    }

    if (overlayState.reason === 'trial_expired') {
      return isArabic ? 'انتهت تجربة الـ 24 ساعة' : '24-Hour Trial Ended';
    }

    return isArabic ? `انتهت حصتك المجانية — ${labelAr}` : `Free Trial Used Up — ${labelEn}`;
  })();
  const message = (() => {
    if (overlayState.mode === 'finished') {
      return isArabic
        ? `استخدمت آخر محاولة مجانية لـ ${labelAr}. للوصول المستمر، اشترك الآن من صفحة الحساب والفوترة.`
        : `You just used your last free ${labelEn} quota. To keep going, subscribe from Account & Billing.`;
    }

    if (overlayState.reason === 'feature_locked') {
      return isArabic
        ? `${labelAr} غير متاحة ضمن تجربة الـ 24 ساعة. اشترك لفتحها.`
        : `${labelEn} is not included in the 24-hour trial. Subscribe to unlock it.`;
    }

    if (overlayState.reason === 'trial_expired') {
      return isArabic
        ? 'انتهت فترة الوصول المجاني لمدة 24 ساعة. اشترك للمتابعة.'
        : 'Your 24-hour free access has ended. Subscribe to continue.';
    }

    return isArabic
      ? `لقد استخدمت جميع المحاولات المجانية لـ ${labelAr}. اشترك للمتابعة بدون حدود.`
      : `You've used all free tries for ${labelEn}. Subscribe to continue without limits.`;
  })();
  const metaLine = overlayState.limit && overlayState.limit > 0 && typeof overlayState.consumed === 'number'
    ? (isArabic
      ? `المستخدم: ${overlayState.consumed} من ${overlayState.limit}`
      : `Used: ${overlayState.consumed} of ${overlayState.limit}`)
    : null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 8%) 30%, hsl(250 20% 10%) 70%, #0c0f14 100%)',
        border: '1.5px solid hsla(210, 100%, 65%, 0.28)',
        borderRadius: '1.5rem',
        padding: '40px 32px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 24px 80px rgba(0,0,0,0.9), 0 0 40px hsla(210, 100%, 65%, 0.2)',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px', lineHeight: 1 }}>🚀</div>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#f2f2f2',
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
        <p style={{
          margin: '0 0 28px',
          fontSize: '1rem',
          color: 'rgba(242,242,242,0.7)',
          lineHeight: 1.6,
        }}>
          {message}
        </p>
        {metaLine ? (
          <div style={{
            margin: '0 0 16px',
            color: 'rgba(233, 206, 176, 0.95)',
            fontSize: '0.92rem',
            fontWeight: 700,
          }}>
            {metaLine}
          </div>
        ) : null}
        <button
          onClick={() => navigate('/account?tab=billing')}
          style={{
            display: 'block',
            width: '100%',
            background: 'linear-gradient(135deg, hsl(210 100% 65%) 0%, hsl(180 85% 60%) 50%, hsl(160 80% 55%) 100%)',
            color: '#060541',
            fontWeight: 800,
            fontSize: '1.05rem',
            borderRadius: '1rem',
            padding: '16px 24px',
            textDecoration: 'none',
            marginBottom: '14px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 0 25px hsla(210, 100%, 65%, 0.45)',
            letterSpacing: '-0.01em',
          }}
        >
          {isArabic ? 'اشترك من الحساب والفوترة' : 'Subscribe in Account & Billing'}
        </button>
        <button
          onClick={() => setOverlayState((prev) => ({ ...prev, open: false }))}
          style={{
            display: 'block',
            width: '100%',
            background: 'transparent',
            border: '1.5px solid rgba(242,242,242,0.18)',
            borderRadius: '1rem',
            color: 'rgba(242,242,242,0.7)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '13px 24px',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(242,242,242,0.45)'; (e.currentTarget as HTMLButtonElement).style.color = '#f2f2f2'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(242,242,242,0.18)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(242,242,242,0.7)'; }}
        >
          {isArabic ? 'إغلاق' : 'Close'}
        </button>
      </div>
    </div>
  );
};

export default TrialGateOverlay;
