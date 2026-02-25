import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
// No action buttons in viewer
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';

const getDeviceOS = (): 'ios' | 'android' | 'other' => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
};

const isInsideWaktiApp = (): boolean => {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/.test(ua);
  const hasNatively = typeof (window as any).natively !== 'undefined';
  return isMobile && hasNatively;
};

export default function DiagramView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { language } = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState('diagram');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deviceOS = getDeviceOS();
  const inApp = isInsideWaktiApp();

  useEffect(() => {
    const fetchDiagram = async () => {
      // Legacy fallback: ?url= param passed directly
      const legacyUrl = searchParams.get('url');
      if (legacyUrl) {
        setUrl(legacyUrl);
        setName(searchParams.get('name') || 'diagram');
        setLoading(false);
        return;
      }

      if (!id) {
        setError(language === 'ar' ? 'معرف المخطط غير موجود' : 'Diagram ID not found');
        setLoading(false);
        return;
      }

      try {
        const { data, error: dbError } = await (supabase
          .from('user_diagrams' as any)
          .select('storage_url, name')
          .eq('id', id)
          .single() as any);

        if (dbError || !data) {
          setError(language === 'ar' ? 'المخطط غير موجود' : 'Diagram not found');
          setLoading(false);
          return;
        }

        const storagePath = data?.storage_url || '';
        setName(data?.name || 'diagram');

        if (storagePath && !storagePath.startsWith('http')) {
          // Try signed URL first
          const { data: signedData, error: signError } = await supabase.storage
            .from('generated-files')
            .createSignedUrl(storagePath, 86400);

          if (signedData?.signedUrl) {
            setUrl(signedData.signedUrl);
          } else {
            console.warn('Signed URL failed, using public URL fallback:', signError);
            // Fallback: construct direct public URL
            const { data: publicData } = supabase.storage
              .from('generated-files')
              .getPublicUrl(storagePath);
            setUrl(publicData?.publicUrl || null);
          }
        } else {
          setUrl(storagePath || null);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch diagram:', err);
        setError(language === 'ar' ? 'حدث خطأ في تحميل المخطط' : 'Error loading diagram');
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [id, searchParams, language]);

  useEffect(() => {
    document.title = `${name.replace(/\.[^.]+$/, '')} | Wakti`;
  }, [name]);

  const cleanName = name.replace(/\.[^.]+$/, '');

  const diagramContent = (
    <>
      {loading ? (
        <div className="text-white/50 text-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      ) : error ? (
        <div className="text-white/50 text-center py-20">
          <p className="text-lg">{error}</p>
        </div>
      ) : !url ? (
        <div className="text-white/50 text-center py-20">
          <p className="text-lg">{language === 'ar' ? 'لم يتم العثور على المخطط' : 'No diagram found'}</p>
        </div>
      ) : (
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {!loaded && (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={url}
            alt={cleanName}
            className={`w-full h-auto max-h-[55vh] object-contain p-4 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
          />
        </div>
      )}
    </>
  );

  /* ── IN-APP VIEW (Wakti mobile app) ── */
  if (inApp) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0c0f14]">
        {/* Header: back + logo */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0c0f14] sticky top-0 z-10">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Back"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
              <img src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" alt="Wakti" className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">Wakti</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-6">
          {diagramContent}
        </main>

        {/* Minimal footer — no store badges */}
        <footer className="flex items-center justify-center py-4 border-t border-white/10">
          <p className="text-white/30 text-xs">
            {language === 'ar' ? 'تم الإنشاء بواسطة' : 'Created with'}{' '}
            <span className="text-white/60 font-semibold">Wakti AI</span>
          </p>
        </footer>
      </div>
    );
  }

  /* ── PUBLIC / BROWSER VIEW ── */
  return (
    <div className="min-h-screen flex flex-col bg-[#0c0f14]">

      {/* Header: centered logo only */}
      <header className="flex items-center justify-center px-4 py-3 border-b border-white/10 bg-[#0c0f14] sticky top-0 z-10">
        <a href="https://wakti.qa" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" alt="Wakti" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-white text-base tracking-wide group-hover:text-white/80 transition-colors">Wakti</span>
        </a>
      </header>

      <main className="flex items-center justify-center px-4 py-6">
        {diagramContent}
      </main>

      {/* Footer with store badges */}
      <footer className="flex flex-col items-center gap-4 py-8 px-4 border-t border-white/10">
        <p className="text-white/50 text-sm">
          {language === 'ar' ? 'تم الإنشاء بواسطة' : 'Created with'}{' '}
          <span className="text-white font-semibold">Wakti AI</span>
        </p>
        <p className="text-white/30 text-xs text-center max-w-xs">
          {language === 'ar'
            ? 'حمّل Wakti وأنشئ مخططاتك الخاصة بالذكاء الاصطناعي'
            : 'Download Wakti and create your own AI-powered diagrams'}
        </p>
        <div className="flex flex-wrap gap-4 justify-center items-center">
          {(deviceOS === 'ios' || deviceOS === 'other') && (
            <a
              href="https://apps.apple.com/us/app/wakti-ai/id6755150700"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-105"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="h-10"
              />
            </a>
          )}
          {(deviceOS === 'android' || deviceOS === 'other') && (
            <a
              href="https://play.google.com/store/apps/details?id=ai.wakti.app"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-all hover:scale-105"
            >
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className="h-14"
              />
            </a>
          )}
        </div>
        <a href="https://wakti.qa" className="text-white/20 hover:text-white/50 text-xs transition-colors mt-1">wakti.qa</a>
      </footer>
    </div>
  );
}
