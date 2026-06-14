import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

const WAKTI_LOGO = '/lovable-uploads/4ed7b33a-201e-4f05-94de-bac892155c01.png';

interface CtaPayload {
  t?: string;
  c?: Array<{ l?: string; u?: string }>;
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

export default function QRCTAView() {
  const [searchParams] = useSearchParams();

  const ctaPayload = useMemo(() => parseJsonPayload<CtaPayload>(searchParams.get('d')), [searchParams]);

  const ctaLinks = useMemo(() => {
    if (!Array.isArray(ctaPayload?.c)) return [];
    return ctaPayload.c
      .map((item, index) => ({
        label: (item?.l || '').trim() || `Link ${index + 1}`,
        url: (item?.u || '').trim(),
      }))
      .filter((item) => !!item.url);
  }, [ctaPayload]);

  if (ctaLinks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white p-6">
        <div className="text-center space-y-4 max-w-sm">
          <img src={WAKTI_LOGO} alt="Wakti" className="w-16 h-16 mx-auto rounded-2xl" />
          <p className="text-lg font-semibold">No CTA links found</p>
          <p className="text-sm text-gray-400">This CTA QR code is empty or invalid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0f14] text-white px-4 py-10">
      <main className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-3">
          <img src={WAKTI_LOGO} alt="Wakti" className="w-14 h-14 mx-auto rounded-2xl" />
          <h1 className="text-2xl font-bold tracking-tight">
            {ctaPayload?.t?.trim() || 'Choose your destination'}
          </h1>
        </div>

        <div className="space-y-3">
          {ctaLinks.map((link, index) => (
            <a
              key={`${link.label}-${index}`}
              href={link.url}
              className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
            >
              <span className="font-semibold text-sm">{link.label}</span>
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
