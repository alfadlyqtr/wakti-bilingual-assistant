import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';

const APP_STORE_URL = 'https://apps.apple.com/us/app/wakti-ai/id6755150700';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.wakti.ai';
const WAKTI_LOGO = '/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png';

type QRMode = 'text' | 'smart' | 'cta';

interface SmartPayload {
  i?: string;
  a?: string;
  f?: string;
}

function decodeBase64Url(value: string): string {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return decodeURIComponent(escape(atob(base64)));
}

function parseJsonPayload<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeBase64Url(value)) as T;
  } catch {
    return null;
  }
}

function isAppleStoreUrl(url: string): boolean {
  return /apps\.apple\.com|itunes\.apple\.com|itms-apps:/i.test(url);
}

function isGooglePlayUrl(url: string): boolean {
  return /play\.google\.com\/store|market:\/\//i.test(url);
}

export default function QRTextView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [smartTarget, setSmartTarget] = useState<string>('');
  const [showManualOptions, setShowManualOptions] = useState(false);

  const mode = useMemo<QRMode>(() => {
    const currentMode = (searchParams.get('mode') || '').toLowerCase();
    if (currentMode === 'smart') return 'smart';
    if (currentMode === 'cta') return 'cta';
    return 'text';
  }, [searchParams]);

  const text = useMemo(() => {
    const t = searchParams.get('t');
    if (!t) return '';
    try {
      return decodeBase64Url(t);
    } catch {
      return t;
    }
  }, [searchParams]);

  const smartPayload = useMemo(() => parseJsonPayload<SmartPayload>(searchParams.get('d')), [searchParams]);
  // Check if user likely has the app (came from in-app browser)
  const isInApp = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('natively') || ua.includes('wakti');
  }, []);

  const fallbackCtaLinks = useMemo(() => {
    if (mode !== 'smart') return [];
    const ios = (smartPayload?.i || '').trim();
    const android = (smartPayload?.a || '').trim();
    const fallback = (smartPayload?.f || '').trim();
    const links = [
      { label: 'URL #1', url: ios },
      { label: 'URL #2', url: android },
      { label: 'Fallback URL', url: fallback },
    ];
    return links.filter((link) => !!link.url);
  }, [mode, smartPayload]);

  useEffect(() => {
    if (mode !== 'smart') return;
    const ios = (smartPayload?.i || '').trim();
    const android = (smartPayload?.a || '').trim();
    const fallback = (smartPayload?.f || '').trim();
    const smartLinks = [ios, android].filter(Boolean);
    const appleStoreUrl = smartLinks.find((url) => isAppleStoreUrl(url)) || '';
    const playStoreUrl = smartLinks.find((url) => isGooglePlayUrl(url)) || '';
    const genericUrl = smartLinks.find((url) => !isAppleStoreUrl(url) && !isGooglePlayUrl(url)) || '';
    const ua = navigator.userAgent || '';
    const hasAndroidSignal = /android/i.test(ua);
    const hasAppleSignal = /iPhone|iPad|iPod|iOS|Macintosh/i.test(ua);
    const hasWindowsPhoneSignal = /Windows Phone/i.test(ua);
    const isStrictAndroid = hasAndroidSignal && !hasAppleSignal && !hasWindowsPhoneSignal;
    const target = isStrictAndroid
      ? (playStoreUrl || genericUrl || fallback || android || ios)
      : (appleStoreUrl || genericUrl || fallback || ios || android);
    if (!target) return;

    setSmartTarget(target);
    setShowManualOptions(false);

    const redirectTimer = window.setTimeout(() => {
      window.location.replace(target);
    }, 80);

    const manualOptionsTimer = window.setTimeout(() => {
      setShowManualOptions(true);
    }, 2200);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearTimeout(manualOptionsTimer);
    };
  }, [mode, smartPayload]);

  if (mode === 'smart') {
    if (fallbackCtaLinks.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white p-6">
          <div className="text-center space-y-4">
            <img src={WAKTI_LOGO} alt="Wakti" className="w-16 h-16 mx-auto rounded-2xl" />
            <p className="text-lg font-semibold">No redirect links found</p>
            <p className="text-sm text-gray-400">This dynamic QR code is empty or invalid.</p>
          </div>
        </div>
      );
    }

    const continueUrl = smartTarget || fallbackCtaLinks[0].url;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0c0f14] via-[#0f1219] to-[#0c0f14] text-white p-6">
        <div className="max-w-md w-full rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] p-6 text-center space-y-5">
          <img src={WAKTI_LOGO} alt="Wakti" className="w-14 h-14 mx-auto rounded-2xl" />
          <div>
            <p className="text-lg font-bold">Opening your destination...</p>
            <p className="text-sm text-gray-400 mt-2">
              {showManualOptions
                ? 'Automatic open did not complete. Use a button below.'
                : 'Redirecting now based on your device.'}
            </p>
          </div>
          <a
            href={continueUrl}
            className="inline-flex items-center justify-center gap-2.5 w-full px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-sm shadow-[0_8px_32px_hsla(210,80%,50%,0.35)] hover:shadow-[0_8px_40px_hsla(210,80%,50%,0.5)] active:scale-[0.98] transition-all"
          >
            Open now
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </a>

          {showManualOptions && fallbackCtaLinks.length > 1 && (
            <div className="pt-1 space-y-2">
              {fallbackCtaLinks.map((link, index) => (
                <a
                  key={`${link.label}-${index}`}
                  href={link.url}
                  className="block w-full px-4 py-2.5 rounded-xl border border-white/[0.12] text-sm text-gray-200 hover:bg-white/[0.06] transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'cta') {
    const encodedPayload = searchParams.get('d') || '';
    const target = encodedPayload
      ? `/qr/cta?d=${encodeURIComponent(encodedPayload)}`
      : '/qr/cta';
    return <Navigate to={target} replace />;
  }

  if (!text) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white p-6">
        <div className="text-center space-y-4">
          <img src={WAKTI_LOGO} alt="Wakti" className="w-16 h-16 mx-auto rounded-2xl" />
          <p className="text-lg font-semibold">No content found</p>
          <p className="text-sm text-gray-400">This QR code link appears to be empty or invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c0f14] via-[#0f1219] to-[#0c0f14] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0c0f14]/80 border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard');
              }
            }}
            className="p-2 -ml-2 rounded-xl hover:bg-white/[0.06] active:scale-95 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <img src={WAKTI_LOGO} alt="Wakti" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-300 truncate">Wakti QR</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Text Card */}
        <div className="rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] shadow-[0_8px_40px_hsla(0,0%,0%,0.4)] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shared Message</span>
            </div>
          </div>
          <div className="px-6 py-6">
            <p className="text-base md:text-lg leading-relaxed text-gray-100 whitespace-pre-wrap break-words">
              {text}
            </p>
          </div>
        </div>

        {/* Generated by Wakti + Download CTA (for non-app users) */}
        {!isInApp && (
          <div className="rounded-3xl bg-gradient-to-br from-[#060541]/40 via-purple-900/20 to-[#060541]/40 border border-purple-500/10 p-6 space-y-5">
            <div className="flex items-center gap-4">
              <img
                src={WAKTI_LOGO}
                alt="Wakti AI"
                className="w-14 h-14 rounded-2xl shadow-[0_4px_20px_hsla(260,70%,50%,0.3)]"
              />
              <div>
                <h3 className="text-lg font-bold text-white">Wakti AI</h3>
                <p className="text-sm text-gray-400">Your intelligent digital partner</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              This message was shared via <span className="font-semibold text-white">Wakti</span> — the ultimate productivity AI app. Create QR codes, manage tasks, chat with AI, and much more.
            </p>

            <a
              href={APP_STORE_URL || PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#060541] to-purple-700 text-white font-bold text-sm shadow-[0_8px_32px_hsla(260,70%,40%,0.4)] hover:shadow-[0_8px_40px_hsla(260,70%,40%,0.5)] active:scale-[0.98] transition-all"
            >
              <Download className="h-5 w-5" />
              Download Wakti AI
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>

            <p className="text-[11px] text-gray-500 text-center">
              Available on iOS & Android
            </p>
          </div>
        )}

        {/* Footer branding */}
        <div className="text-center pb-8">
          <p className="text-xs text-gray-600">
            Generated with Wakti QR Code Creator
          </p>
        </div>
      </main>
    </div>
  );
}
