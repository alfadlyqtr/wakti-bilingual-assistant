import React, { useEffect, useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTheme } from "@/providers/ThemeProvider";

interface TrialGateOverlayProps {
  featureKey: string;
  limit: number;
  featureLabel?: { en: string; ar: string };
}

const TrialGateOverlay: React.FC<TrialGateOverlayProps> = ({ featureKey, limit, featureLabel }) => {
  const [blocked, setBlocked] = useState(false);
  const { language } = useTheme();
  const { user: authUser } = useAuth();
  const { profile: cachedProfile, isSubscribed, isAdminGifted, hasTrialStarted } = useUserProfile();

  useEffect(() => {
    // Reset when featureKey/limit changes (e.g. switching submodes)
    setBlocked(false);

    // Empty featureKey means OPEN / unlimited — never block
    if (!featureKey) return;

    // Paid / gifted / no trial started — never block
    if (isSubscribed || isAdminGifted || !hasTrialStarted) return;

    // Check cached trial_usage
    if (cachedProfile) {
      const usage = (cachedProfile.trial_usage as Record<string, number>) ?? {};
      const current = typeof usage[featureKey] === 'number' ? usage[featureKey] : 0;
      if (current >= limit) {
        setBlocked(true);
      }
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.feature === featureKey) setBlocked(true);
    };
    window.addEventListener('wakti-trial-limit-reached', handler);
    return () => { window.removeEventListener('wakti-trial-limit-reached', handler); };
  }, [featureKey, limit, isSubscribed, isAdminGifted, hasTrialStarted, cachedProfile]);

  if (!blocked) return null;

  const labelEn = featureLabel?.en || 'This Feature';
  const labelAr = featureLabel?.ar || 'هذه الميزة';

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
        background: 'linear-gradient(135deg, #0c0f14 0%, hsl(235,25%,10%) 50%, hsl(250,20%,12%) 100%)',
        border: '1.5px solid rgba(130,100,255,0.35)',
        borderRadius: '1.5rem',
        padding: '40px 32px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 24px 80px rgba(0,0,0,0.9), 0 0 60px rgba(130,100,255,0.15)',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px', lineHeight: 1 }}>🚀</div>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#f2f2f2',
          letterSpacing: '-0.02em',
        }}>
          {language === 'ar' ? `انتهت تجربتك المجانية — ${labelAr}` : `Free Trial Used Up — ${labelEn}`}
        </h2>
        <p style={{
          margin: '0 0 28px',
          fontSize: '1rem',
          color: 'rgba(242,242,242,0.7)',
          lineHeight: 1.6,
        }}>
          {language === 'ar'
            ? `لقد استخدمت جميع المحاولات المجانية لـ ${labelAr}. اشترك للحصول على وصول غير محدود!`
            : `You've used all your free tries for ${labelEn}. Subscribe for unlimited access!`}
        </p>
        <a
          href="https://apps.apple.com/us/app/wakti-ai/id6755150700"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            background: 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(260,80%,65%) 50%, hsl(280,70%,65%) 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.1rem',
            borderRadius: '1rem',
            padding: '16px 24px',
            textDecoration: 'none',
            marginBottom: '14px',
            boxShadow: '0 4px 24px hsla(260,80%,65%,0.45)',
            letterSpacing: '-0.01em',
          }}
        >
          {language === 'ar' ? '⚡ اشترك الآن' : '⚡ Subscribe Now'}
        </a>
        <button
          onClick={() => window.history.back()}
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
          {language === 'ar' ? '← رجوع' : 'Go back →'}
        </button>
      </div>
    </div>
  );
};

export default TrialGateOverlay;
