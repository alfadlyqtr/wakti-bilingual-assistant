import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

export default function TextTranslationView() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [meta, setMeta] = useState<{ source_filename: string | null; target_language: string | null; created_at: string | null } | null>(null);

  const backFallback = useMemo(() => {
    const state = location.state as any;
    return state?.from || '/tools/text?tab=translate';
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!id) {
        setError(language === 'ar' ? 'معرّف غير صالح' : 'Invalid translation id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('user_translations')
          .select('translated_text, source_filename, target_language, created_at')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          throw new Error(language === 'ar' ? 'لم يتم العثور على الترجمة' : 'Translation not found');
        }

        if (cancelled) return;
        setTranslatedText(data.translated_text || '');
        setMeta({
          source_filename: data.source_filename || null,
          target_language: data.target_language || null,
          created_at: data.created_at || null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || (language === 'ar' ? 'حدث خطأ' : 'Something went wrong'));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [id, language]);

  const handleBack = () => {
    navigate('/tools/text?tab=translate&ttSection=my');
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-none pt-6 md:pt-8 pb-6 px-3 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="h-10 px-4 rounded-xl text-sm font-medium btn-secondary-enhanced btn-3d-pop active:scale-95"
          >
            {language === 'ar' ? 'رجوع' : 'Back'}
          </button>

          <div className="flex-1 text-center">
            <div className="text-base md:text-lg font-semibold">
              {language === 'ar' ? 'النص المترجم' : 'Translated Text'}
            </div>
            {meta?.source_filename && (
              <div className="text-[11px] text-muted-foreground line-clamp-1">
                {meta.source_filename}{meta.target_language ? ` · ${language === 'ar' ? 'إلى' : 'to'} ${meta.target_language}` : ''}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={async () => {
              if (!translatedText) return;
              await navigator.clipboard.writeText(translatedText);
            }}
            disabled={!translatedText || loading}
            className="h-10 px-4 rounded-xl text-sm font-medium btn-enhanced btn-3d-pop text-white disabled:opacity-60 active:scale-95 inline-flex items-center gap-2"
          >
            <Copy className="h-4 w-4" /> {language === 'ar' ? 'نسخ' : 'Copy'}
          </button>
        </div>

        <div className="enhanced-card rounded-2xl p-4 md:p-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : (
            <textarea
              readOnly
              value={translatedText}
              dir="auto"
              aria-label={language === 'ar' ? 'النص المترجم' : 'Translated text'}
              className="w-full h-[65vh] md:h-[70vh] rounded-xl border border-border input-enhanced p-4 text-sm leading-relaxed"
            />
          )}
        </div>
      </div>
    </div>
  );
}
