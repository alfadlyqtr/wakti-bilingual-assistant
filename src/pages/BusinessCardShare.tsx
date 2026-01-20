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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-blue-500/5 p-4">
      <CardPreviewLive data={card as any} />
    </div>
  );
}
