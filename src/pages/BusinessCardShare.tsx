import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CardPreviewLive } from '@/components/business-card/BusinessCardBuilder';

interface BusinessCardData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  website: string;
  logoUrl: string;
  profilePhotoUrl: string;
  coverPhotoUrl?: string;
  department?: string;
  headline?: string;
  address?: string;
  socialLinks?: Array<{ id: string; type: string; url: string; label?: string }>;
  template?: 'geometric' | 'professional' | 'fashion' | 'minimal' | 'clean';
  primaryColor?: string;
  mosaicPaletteId?: string;
  mosaicColors?: {
    light?: string;
    mid?: string;
    dark?: string;
    deepest?: string;
  };
  professionalColors?: {
    band?: string;
    ring?: string;
    line?: string;
    lineHeight?: number;
    bandHeight?: number;
  };
  fashionColors?: {
    curve?: string;
    star?: string;
    starGlow?: boolean;
  };
  minimalColors?: {
    background?: string;
    header?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  cleanColors?: {
    background?: string;
    header?: string;
    accent?: string;
    text?: string;
    muted?: string;
  };
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  photoShape?: 'circle' | 'square';
  nameStyle?: any;
  titleStyle?: any;
  companyStyle?: any;
  iconStyle?: {
    showBackground?: boolean;
    backgroundColor?: string;
    iconColor?: string;
    useBrandColors?: boolean;
    colorIntensity?: number;
  };
}

export default function BusinessCardShare() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [card, setCard] = useState<BusinessCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [triedDeepLink, setTriedDeepLink] = useState(false);

  // Attempt to open the Wakti app via deep link (only once)
  // Uses an invisible iframe to avoid navigating away from the page
  useEffect(() => {
    if (!shareSlug || triedDeepLink) return;
    setTriedDeepLink(true);

    // Build the deep link URL
    const deepLinkUrl = `wakti://card/${encodeURIComponent(shareSlug)}`;

    // Create an invisible iframe to attempt the deep link
    // This prevents navigating away from the page if the app isn't installed
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLinkUrl;
    document.body.appendChild(iframe);

    // Clean up iframe after a short delay
    const cleanup = setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 2000);

    return () => {
      clearTimeout(cleanup);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }, [shareSlug, triedDeepLink]);

  useEffect(() => {
    const load = async () => {
      if (!shareSlug) {
        setError('Invalid link');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .rpc('get_business_card_by_share_slug', { p_share_slug: shareSlug });

        if (error) {
          setError('Card not found');
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError('Card not found');
          setLoading(false);
          return;
        }

        const mapped: BusinessCardData = {
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          email: row.email || '',
          phone: row.phone || '',
          companyName: row.company_name || '',
          jobTitle: row.job_title || '',
          website: row.website || '',
          logoUrl: row.logo_url || '',
          profilePhotoUrl: row.profile_photo_url || '',
          coverPhotoUrl: row.cover_photo_url || '',
          department: row.department || '',
          headline: row.headline || '',
          address: row.address || '',
          socialLinks: row.social_links || [],
          template: row.template || 'geometric',
          primaryColor: row.primary_color || '#6366f1',
          mosaicPaletteId: row.mosaic_palette_id || 'rose',
          mosaicColors: row.mosaic_colors || undefined,
          professionalColors: row.professional_colors || undefined,
          fashionColors: row.fashion_colors || undefined,
          minimalColors: row.minimal_colors || undefined,
          cleanColors: row.clean_colors || undefined,
          logoPosition: row.logo_position || 'top-right',
          photoShape: row.photo_shape || 'circle',
          nameStyle: row.name_style || undefined,
          titleStyle: row.title_style || undefined,
          companyStyle: row.company_style || undefined,
          iconStyle: row.icon_style || undefined,
        };

        setCard(mapped);
        setLoading(false);
      } catch (e: any) {
        setError('Failed to load card');
        setLoading(false);
      }
    };

    load();
  }, [shareSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Loading card...</span>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-center space-y-2">
          <h1 className="text-lg font-semibold">Invalid or expired link</h1>
          <p className="text-sm text-muted-foreground">{error || 'We could not find this business card.'}</p>
        </div>
      </div>
    );
  }

  const appStoreUrl = 'https://apps.apple.com/us/app/wakti-ai/id6755150700';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-blue-500/5">
      {/* Header: Logo top-left only */}
      <header className="flex items-center px-4 py-3">
        <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <img
            src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png"
            alt="Wakti AI"
            className="w-10 h-10 object-contain"
          />
        </a>
      </header>

      {/* Card container - moved up with less padding */}
      <div className="flex-1 flex flex-col items-center pt-2 px-4 relative">
        {/* Card + Arrow hint wrapper */}
        <div className="relative">
          {/* Card with enhanced 3D shadow effect */}
          <div className="drop-shadow-2xl" style={{ filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.35)) drop-shadow(0 10px 20px rgba(99, 102, 241, 0.15))' }}>
            <CardPreviewLive
              data={card as any}
              isFlipped={isFlipped}
              handleFlip={() => setIsFlipped((v) => !v)}
              handleAddToWallet={() => {}}
            />
          </div>
          
          {/* Curveball arrow + chip - shows on both sides with different text */}
          <div className="absolute -bottom-20 right-0 flex items-start gap-0 animate-pulse">
            {/* Chip button */}
            <button
              onClick={() => setIsFlipped((v) => !v)}
              className="text-sm font-medium text-primary bg-white/95 dark:bg-black/70 px-4 py-2 rounded-full shadow-lg border border-primary/30 hover:bg-primary hover:text-white transition-colors cursor-pointer active:scale-95"
            >
              {isFlipped ? 'Flip to see card' : 'Flip to add as contact'}
            </button>
            {/* Curveball arrow - dramatic curve pointing up toward flip button */}
            <svg
              width="70"
              height="80"
              viewBox="0 0 70 80"
              fill="none"
              className="text-primary -ml-2 -mt-12"
            >
              {/* Curveball path - sweeping curve like a pitcher's throw */}
              <path
                d="M60 75 C 65 55, 55 35, 35 25 C 15 15, 10 10, 15 5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head pointing up-left */}
              <path
                d="M15 5 L 22 10 M15 5 L 18 14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Footer: Powered by Wakti AI - bottom center */}
      <footer className="flex justify-center px-4 py-4 pb-6">
        <a
          href={appStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
        >
          <span className="text-xs text-muted-foreground">Powered by</span>
          <span className="text-sm font-semibold text-primary">Wakti AI</span>
        </a>
      </footer>
    </div>
  );
}
