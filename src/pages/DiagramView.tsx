import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';

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
  const { id } = useParams<{ id: string }>();
  const { language } = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState('diagram');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inApp = isInsideNatively();
  const deviceOS = getDeviceOS();

  useEffect(() => {
    const fetchDiagram = async () => {
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

        setUrl(data?.storage_url || null);
        setName(data?.name || 'diagram');
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch diagram:', err);
        setError(language === 'ar' ? 'حدث خطأ في تحميل المخطط' : 'Error loading diagram');
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [id, language]);

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
              <img src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png" alt="Wakti" className="w-full h-full object-contain" />
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
        {loading ? (
          <div className="text-white/50 text-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : error ? (
          <div className="text-white/50 text-center">
            <p className="text-lg">{error}</p>
          </div>
        ) : !url ? (
          <div className="text-white/50 text-center">
            <p className="text-lg">{language === 'ar' ? 'لم يتم العثور على المخطط' : 'No diagram found'}</p>
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
