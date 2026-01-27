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
      {/* Header: Logo left, Powered by Wakti AI center */}
      <header className="flex items-center justify-between px-4 py-3 relative">
        {/* Logo top-left */}
        <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
          <img
            src="/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png"
            alt="Wakti AI"
            className="w-10 h-10 object-contain"
          />
        </a>
        
        {/* Powered by Wakti AI - center */}
        <a
          href={appStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
        >
          <span className="text-xs text-muted-foreground">Powered by</span>
          <span className="text-sm font-semibold text-primary">Wakti AI</span>
        </a>
        
        {/* Spacer for balance */}
        <div className="w-10" />
      </header>

      {/* Card container with flip hint */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <CardPreviewLive
          data={card as any}
          isFlipped={isFlipped}
          handleFlip={() => setIsFlipped((v) => !v)}
          handleAddToWallet={() => {}}
        />
        
        {/* Curved arrow pointing UP to flip button with hint text */}
        {!isFlipped && (
          <div className="absolute bottom-4 right-4 flex flex-col items-center animate-pulse">
            {/* Curved arrow SVG pointing UP toward the flip button */}
            <svg
              width="60"
              height="80"
              viewBox="0 0 60 80"
              fill="none"
              className="text-primary mb-1"
            >
              {/* Arrow head pointing up */}
              <path
                d="M30 5 L 24 15 M30 5 L 36 15"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Curved line going down */}
              <path
                d="M30 5 C 30 25, 35 45, 30 70"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <button
              onClick={() => setIsFlipped(true)}
              className="text-sm font-medium text-primary bg-white/90 dark:bg-black/60 px-4 py-2 rounded-full shadow-md border border-primary/30 hover:bg-primary hover:text-white transition-colors cursor-pointer active:scale-95"
            >
              Flip to add as contact
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
