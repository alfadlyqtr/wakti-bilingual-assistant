import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Share2, ArrowLeft } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

export default function DiagramView() {
  const [searchParams] = useSearchParams();
  const { language } = useTheme();
  const url = searchParams.get('url');
  const name = searchParams.get('name') || 'diagram';
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = `${name.replace(/\.[^.]+$/, '')} | Wakti`;
  }, [name]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: name, url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  };

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
        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              download={name}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all text-white/70 hover:text-white border border-white/10 hover:border-white/30"
            >
              <Download className="w-3.5 h-3.5" />
              {language === 'ar' ? 'تحميل' : 'Download'}
            </a>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all text-white/70 hover:text-white border border-white/10 hover:border-white/30"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
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

      {/* Footer */}
      <footer className="text-center py-4 text-white/30 text-xs">
        Created with <span className="text-white/50 font-medium">Wakti AI</span> · <a href="https://wakti.qa" className="text-white/50 hover:text-white transition-colors">wakti.qa</a>
      </footer>
    </div>
  );
}
