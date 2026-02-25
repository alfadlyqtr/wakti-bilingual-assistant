import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

const isInsideNatively = (): boolean => {
  return typeof (window as any).natively !== 'undefined' || /Natively/i.test(navigator.userAgent);
};

const getDeviceOS = (): 'ios' | 'android' | 'other' => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
};

export default function DiagramView() {
  const [searchParams] = useSearchParams();
  const { language } = useTheme();
  const url = searchParams.get('url');
  const name = searchParams.get('name') || 'diagram';
  const [loaded, setLoaded] = useState(false);
  const inApp = isInsideNatively();
  const deviceOS = getDeviceOS();

  useEffect(() => {
    document.title = `${name.replace(/\.[^.]+$/, '')} | Wakti`;
  }, [name]);

  const cleanName = name.replace(/\.[^.]+$/, '');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0c0f14 0%, hsl(235,25%,7%) 25%, hsl(250,20%,8%) 50%, #0c0f14 100%)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur-sm sticky top-0 z-10" style={{ background: 'rgba(12,15,20,0.85)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            title={language === 'ar' ? 'رجوع' : 'Go back'}
            className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              <img src="/favicon.ico" alt="Wakti" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">Wakti</span>
          </div>
          {cleanName && (
            <>
              <span className="text-white/30 text-sm">/</span>
              <span className="text-white/70 text-sm truncate max-w-[200px]">{cleanName}</span>
            </>
          )}
        </div>
      </header>

      {/* Diagram Area */}
      <main className="flex-1 flex items-center justify-center p-6">
        {!url ? (
          <div className="text-white/50 text-center">
            <p className="text-lg">No diagram found</p>
          </div>
        ) : (
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ minHeight: 400 }}>
            {!loaded && (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={url}
              alt={cleanName}
              className={`w-full h-auto object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ maxHeight: '80vh' }}
              onLoad={() => setLoaded(true)}
            />
          </div>
        )}
      </main>

      {/* Footer — only shown outside the app */}
      {!inApp && (
        <footer className="flex flex-col items-center gap-3 py-6 px-4">
          <p className="text-white/40 text-xs">
            {language === 'ar' ? 'تم الإنشاء بواسطة' : 'Created with'}{' '}
            <span className="text-white/60 font-medium">Wakti AI</span>
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {(deviceOS === 'ios' || deviceOS === 'other') && (
              <a
                href="https://apps.apple.com/us/app/wakti-ai/id6755150700"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 100%)' }}
              >
                {language === 'ar' ? '📱 App Store' : '📱 App Store'}
              </a>
            )}
            {(deviceOS === 'android' || deviceOS === 'other') && (
              <a
                href="https://play.google.com/store/apps/details?id=app.natively.waktiqa"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, hsl(142,76%,55%) 0%, hsl(180,85%,60%) 100%)' }}
              >
                {language === 'ar' ? '📱 Google Play' : '📱 Google Play'}
              </a>
            )}
          </div>
          <a href="https://wakti.qa" className="text-white/30 hover:text-white/60 text-xs transition-colors">wakti.qa</a>
        </footer>
      )}
    </div>
  );
}
