import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';
import InAppWaktiEscape from '@/components/public/InAppWaktiEscape';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, ExternalLink, Gift, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicWishlistOwner {
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface PublicWishlistItem {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  product_url?: string | null;
  priority: number;
  is_received: boolean;
  ai_extracted: boolean;
}

interface PublicWishlistData {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  allow_claims: boolean;
  owner: PublicWishlistOwner;
  items: PublicWishlistItem[];
}

const priorityLabels = {
  1: { en: 'Nice to have', ar: 'جميل لو وجد' },
  2: { en: 'Would like', ar: 'أريده' },
  3: { en: 'Really want', ar: 'أريده فعلاً' },
  4: { en: 'Really need', ar: 'أحتاجه' },
  5: { en: 'Must have!', ar: 'ضروري!' },
} as const;

function PublicWishlistItemCard({ item, isAr }: { item: PublicWishlistItem; isAr: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = item.title.length > 28 || Boolean(item.description && item.description.length > 90);

  return (
    <Card className={cn('border border-border/60 bg-card/80', item.is_received && 'opacity-70')}>
      <CardContent className="p-3">
        <div className="flex gap-3">
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title}
              className="h-16 w-16 rounded-lg object-cover border flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn('font-semibold text-sm', expanded ? 'whitespace-normal break-words' : 'truncate', item.is_received && 'line-through text-muted-foreground')}>
              {item.title}
            </p>
            {item.description && (
              <p className={cn('mt-0.5 text-xs text-muted-foreground', expanded ? 'whitespace-pre-wrap break-words' : 'truncate')}>
                {item.description}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-[hsl(45,100%,60%)]">{'⭐'.repeat(Math.max(1, Math.min(5, item.priority || 2)))}</span>
              <span className="text-muted-foreground">{priorityLabels[(item.priority as 1 | 2 | 3 | 4 | 5) || 2][isAr ? 'ar' : 'en']}</span>
              {item.product_url && (
                <a
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[hsl(210,100%,65%)]"
                >
                  <ExternalLink className="h-3 w-3" />
                  {isAr ? 'الرابط' : 'Link'}
                </a>
              )}
            </div>
            {canExpand && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[hsl(210,100%,65%)]"
              >
                <span>{expanded ? (isAr ? 'إخفاء' : 'Show less') : (isAr ? 'عرض المزيد' : 'Show more')}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicWishlist() {
  const { id } = useParams<{ id: string }>();
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [wishlist, setWishlist] = useState<PublicWishlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWishlist = async () => {
      if (!id) {
        setError(isAr ? 'رابط غير صالح' : 'Invalid link');
        setLoading(false);
        return;
      }

      try {
        const base = SUPABASE_URL.replace(/\/$/, '');
        const response = await fetch(`${base}/functions/v1/wishlist-share-public?id=${encodeURIComponent(id)}`, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.wishlist) {
          setError(payload?.error || (isAr ? 'هذه القائمة غير متاحة' : 'This wishlist is unavailable'));
          setLoading(false);
          return;
        }

        setWishlist(payload.wishlist as PublicWishlistData);
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError((isAr ? 'فشل التحميل: ' : 'Failed to load: ') + message);
        setLoading(false);
      }
    };

    loadWishlist();
  }, [id, isAr]);

  const eventLabel = useMemo(() => {
    if (!wishlist?.event_date) return null;
    try {
      return new Date(wishlist.event_date).toLocaleDateString(isAr ? 'ar' : 'en');
    } catch {
      return wishlist.event_date;
    }
  }, [isAr, wishlist?.event_date]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(210,100%,65%)]" />
          <span className="text-sm text-muted-foreground">{isAr ? 'جارٍ تحميل القائمة...' : 'Loading wishlist...'}</span>
        </div>
      </div>
    );
  }

  if (error || !wishlist) {
    return (
      <div className="min-h-screen bg-background p-4">
        <InAppWaktiEscape language={isAr ? 'ar' : 'en'} containerClassName="max-w-3xl" />
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <Card className="w-full border border-border/60 bg-card/80 p-6 text-center space-y-3">
            <h1 className="text-lg font-semibold">{isAr ? 'القائمة غير متاحة' : 'Wishlist unavailable'}</h1>
            <p className="text-sm text-muted-foreground">{error || (isAr ? 'لم نتمكن من العثور على هذه القائمة.' : 'We could not find this wishlist.')}</p>
            <Link to="/home">
              <Button variant="outline" className="mt-2 w-full">{isAr ? 'العودة إلى وقتي' : 'Back to Wakti'}</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const ownerName = wishlist.owner.display_name || wishlist.owner.username;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <InAppWaktiEscape language={isAr ? 'ar' : 'en'} containerClassName="max-w-3xl" />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 overflow-hidden rounded-3xl border border-border/60 bg-[linear-gradient(135deg,#0c0f14_0%,hsl(235_25%_8%)_30%,hsl(250_20%_10%)_70%,#0c0f14_100%)] p-5 shadow-[0_4px_32px_hsla(0,0%,0%,0.7),0_2px_16px_hsla(210,100%,65%,0.3)]">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border border-white/10">
              {wishlist.owner.avatar_url && <AvatarImage src={wishlist.owner.avatar_url} />}
              <AvatarFallback>{(wishlist.owner.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[hsl(210,100%,75%)]">{isAr ? 'قائمة رغبات عامة' : 'Public Wishlist'}</p>
              <h1 className="mt-1 text-2xl font-bold text-white break-words">{wishlist.title}</h1>
              <p className="mt-1 text-sm text-white/75">{isAr ? 'بواسطة' : 'By'} {ownerName}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-white/10 text-white border-white/10">
              <Gift className="mr-1 h-3 w-3" />
              {wishlist.items.length} {isAr ? 'عنصر' : 'items'}
            </Badge>
            {eventLabel && (
              <Badge variant="secondary" className="bg-white/10 text-white border-white/10">
                {isAr ? 'التاريخ' : 'Event'}: {eventLabel}
              </Badge>
            )}
            {wishlist.allow_claims && (
              <Badge variant="secondary" className="bg-[hsl(142,76%,55%)]/15 text-[hsl(142,76%,65%)] border-[hsl(142,76%,55%)]/20">
                {isAr ? 'الحجز مفعّل' : 'Claims enabled'}
              </Badge>
            )}
          </div>

          {wishlist.description && (
            <p className="mt-4 text-sm leading-6 text-white/85 whitespace-pre-wrap">{wishlist.description}</p>
          )}
        </div>

        {wishlist.items.length === 0 ? (
          <Card className="border border-border/60 bg-card/70">
            <CardContent className="py-10 text-center text-muted-foreground">
              {isAr ? 'هذه القائمة فارغة حالياً' : 'This wishlist is empty for now'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {wishlist.items.map((item) => (
              <PublicWishlistItemCard key={item.id} item={item} isAr={isAr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
