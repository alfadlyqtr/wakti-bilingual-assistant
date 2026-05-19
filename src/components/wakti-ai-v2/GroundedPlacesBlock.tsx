import React from 'react';
import { MapPin, Phone, Globe, Navigation, Star, MessageCircle } from 'lucide-react';

type MessageLike = {
  content?: string;
  browsingData?: any;
  metadata?: any;
};

export function resolveGroundedBrowsingData(message: MessageLike | null | undefined) {
  if (!message || typeof message !== 'object') return null;
  return message.browsingData || message.metadata?.browsingData || message.metadata?.geminiSearch || null;
}

export function getGroundedPlaces(message: MessageLike | null | undefined): any[] {
  const resolvedBrowsingData = resolveGroundedBrowsingData(message);
  return Array.isArray(resolvedBrowsingData?.places) ? resolvedBrowsingData.places : [];
}

export function hasGroundedPlaces(message: MessageLike | null | undefined) {
  return getGroundedPlaces(message).length > 0;
}

function normalizePhoneHref(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function formatReviewCount(count?: number | null, language?: string) {
  if (typeof count !== 'number' || !Number.isFinite(count)) return '';
  return new Intl.NumberFormat(language === 'ar' ? 'ar-QA' : 'en-US').format(count);
}

function truncateReviewText(value?: string, max = 200) {
  const text = (value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function getGoogleMapsSearchUrl(resolvedBrowsingData: any, groundedPlaces: any[]) {
  const queries = Array.isArray(resolvedBrowsingData?.queries) ? resolvedBrowsingData.queries : [];
  const query = queries.find((value: unknown) => typeof value === 'string' && value.trim()) as string | undefined;
  if (query && query.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
  }
  return typeof groundedPlaces[0]?.mapsUrl === 'string' ? groundedPlaces[0].mapsUrl : '';
}

function parseReviewTitle(title?: string): { author: string; rating: number | null; relTime: string } {
  if (!title) return { author: '', rating: null, relTime: '' };
  const parts = title.split('·').map((p) => p.trim());
  const author = parts[0] || '';
  let rating: number | null = null;
  let relTime = '';
  for (const p of parts.slice(1)) {
    const starMatch = p.match(/^([\d.]+)★/);
    if (starMatch) { rating = parseFloat(starMatch[1]); continue; }
    if (p) relTime = p;
  }
  return { author, rating, relTime };
}

function StarRating({ value, max = 5, size = 14 }: { value: number; max?: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= max; i++) {
    const fill = Math.min(1, Math.max(0, value - (i - 1)));
    stars.push(
      <span key={i} style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
        <Star size={size} className="text-muted-foreground/30" fill="currentColor" />
        {fill > 0 && (
          <span style={{ position: 'absolute', top: 0, left: 0, width: `${fill * 100}%`, overflow: 'hidden', display: 'inline-block' }}>
            <Star size={size} className="text-amber-400" fill="currentColor" />
          </span>
        )}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-0.5">{stars}</span>;
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="white" />
    </svg>
  );
}

function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path d="M16 8h-2a1 1 0 0 0-1 1v2h3l-.5 3H13v7h-3v-7H8v-3h2V9a4 4 0 0 1 4-4h2v3z" fill="white" />
    </svg>
  );
}

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#010101" />
      <path d="M17 8.5a3.5 3.5 0 0 1-3.5-3.5V4h-2.5v11a1.5 1.5 0 1 1-1.5-1.5 1.6 1.6 0 0 1 .5.1V11a4 4 0 1 0 4 4V9.4A6 6 0 0 0 17 10V8.5z" fill="white" />
    </svg>
  );
}

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="#25D366" />
      <path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4zm4.2 10.9c-.2.5-1 1-1.4 1-.4.1-.8.1-2.5-.5s-2.8-2.1-3.2-2.8c-.4-.6-.4-1.1-.1-1.5.1-.2.3-.3.4-.3h.3c.2 0 .3.1.4.3l.6 1.3c.1.2.1.4 0 .6l-.3.4c.3.5.8 1 1.3 1.4.5.3 1 .5 1.5.6l.4-.3c.2-.2.4-.2.6-.1l1.3.6c.2.1.3.3.3.5 0 .1-.1.5-.2.8z" fill="white" />
    </svg>
  );
}

export function GroundedPlacesBlock({
  message,
  language,
}: {
  message: MessageLike;
  language: string;
}) {
  const resolvedBrowsingData = resolveGroundedBrowsingData(message);
  const groundedPlaces = Array.isArray(resolvedBrowsingData?.places) ? resolvedBrowsingData.places : [];
  const searchEntryPointHtml = typeof resolvedBrowsingData?.searchEntryPointHtml === 'string'
    ? resolvedBrowsingData.searchEntryPointHtml.trim()
    : '';
  const googleMapsSearchUrl = getGoogleMapsSearchUrl(resolvedBrowsingData, groundedPlaces);

  if (groundedPlaces.length === 0) return null;

  const isAr = language === 'ar';

  // Only show cards that have at least one meaningful field beyond just name+mapsUrl
  const richPlaces = groundedPlaces.slice(0, 6).filter((place: any) => {
    const phoneHref = normalizePhoneHref(place.phone);
    const hasRating = typeof place.rating === 'number';
    const hasAddress = Boolean(place.address && place.address.trim());
    const hasPhone = Boolean(phoneHref);
    const hasWeb = Boolean(place.websiteUrl && place.websiteUrl.trim());
    const hasSocials = Boolean(place.instagramUrl || place.facebookUrl || place.tiktokUrl || place.whatsappUrl);
    const hasReviews = Array.isArray(place.reviewSnippets) && place.reviewSnippets.some((r: any) => r?.snippet);
    const hasEditorial = Boolean(place.editorialSummary && place.editorialSummary.trim());
    // Must have at least rating or phone — a card with only address/website looks broken
    return (hasRating || hasPhone) || (hasSocials && (hasRating || hasPhone || hasAddress)) || (hasReviews && hasAddress);
  });

  // If no place has rich data, skip the entire block — the written text is enough
  if (richPlaces.length === 0) {
    // Still show the Maps bottom block if we have it
    if (!searchEntryPointHtml && !googleMapsSearchUrl) return null;
    return (
      <div className="space-y-3 pt-2">
        <div className="rounded-xl border border-border/50 bg-muted/10 p-3 dark:bg-white/5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground" translate="no">Google Maps</div>
            {googleMapsSearchUrl && (
              <a href={googleMapsSearchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-400 underline" translate="no">
                {isAr ? 'عرض كل الأماكن' : 'View all places'}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {richPlaces.map((place: any, index: number) => {
        const phoneHref = normalizePhoneHref(place.phone);
        const reviewSnippets = Array.isArray(place.reviewSnippets)
          ? place.reviewSnippets.filter((item: any) => item?.snippet || item?.googleMapsUri || item?.uri).slice(0, 2)
          : [];
        const hasMaps = Boolean(place.mapsUrl);
        const hasCall = Boolean(phoneHref);
        const hasWeb = Boolean(place.websiteUrl && place.websiteUrl.trim());
        const hasSocials = Boolean(place.instagramUrl || place.facebookUrl || place.tiktokUrl || place.whatsappUrl);

        return (
          <div
            key={`${place.placeId || place.name || 'place'}-${index}`}
            className="rounded-xl border border-border/40 overflow-hidden"
            style={{ background: 'var(--card, hsl(var(--card)))' }}
          >
            {/* ── Header ── */}
            <div className="px-4 pt-4 pb-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">🏪</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] text-foreground leading-tight truncate">
                      {place.name || (isAr ? 'مكان' : 'Place')}
                    </div>
                  </div>
                </div>
                {typeof place.openNow === 'boolean' && (
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      place.openNow
                        ? 'bg-green-500/15 text-green-500'
                        : 'bg-red-500/15 text-red-500'
                    }`}
                  >
                    {isAr ? (place.openNow ? 'مفتوح' : 'مغلق') : (place.openNow ? 'Open' : 'Closed')}
                  </span>
                )}
              </div>

              {/* Star rating row */}
              {typeof place.rating === 'number' && (
                <div className="flex items-center gap-2">
                  <StarRating value={place.rating} />
                  <span className="text-sm font-semibold text-foreground">{place.rating.toFixed(1)}</span>
                  {typeof place.userRatingCount === 'number' && (
                    <span className="text-xs text-muted-foreground">
                      ({formatReviewCount(place.userRatingCount, language)} {isAr ? 'تقييم' : 'reviews'})
                    </span>
                  )}
                </div>
              )}

              {/* Editorial summary */}
              {place.editorialSummary && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {truncateReviewText(place.editorialSummary, 160)}
                </p>
              )}

              {/* Info rows */}
              <div className="space-y-1.5 pt-0.5">
                {place.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} className="shrink-0 mt-0.5 text-muted-foreground/70" />
                    <span className="leading-tight">{place.address}</span>
                  </div>
                )}
                {phoneHref && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone size={14} className="shrink-0 text-muted-foreground/70" />
                    <a href={phoneHref} className="hover:text-foreground transition-colors">
                      {place.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ── Action buttons ── */}
            {(hasMaps || hasCall || hasWeb) && (
              <div className="px-4 pb-3 flex gap-2">
                {hasMaps && (
                  <a
                    href={place.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 py-2 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Navigation size={13} />
                    {isAr ? 'الخريطة' : 'Maps'}
                  </a>
                )}
                {hasCall && (
                  <a
                    href={phoneHref}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 py-2 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Phone size={13} />
                    {isAr ? 'اتصال' : 'Call'}
                  </a>
                )}
                {hasWeb && (
                  <a
                    href={place.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/50 py-2 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Globe size={13} />
                    {isAr ? 'الموقع' : 'Website'}
                  </a>
                )}
              </div>
            )}

            {/* ── Social follow badges ── */}
            {hasSocials && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground mr-1">{isAr ? 'تابع:' : 'Follow:'}</span>
                {place.instagramUrl && (
                  <a href={place.instagramUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 bg-muted/30 hover:bg-muted/60 transition-colors" title="Instagram">
                    <InstagramIcon size={20} />
                  </a>
                )}
                {place.facebookUrl && (
                  <a href={place.facebookUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 bg-muted/30 hover:bg-muted/60 transition-colors" title="Facebook">
                    <FacebookIcon size={20} />
                  </a>
                )}
                {place.tiktokUrl && (
                  <a href={place.tiktokUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 bg-muted/30 hover:bg-muted/60 transition-colors" title="TikTok">
                    <TikTokIcon size={20} />
                  </a>
                )}
                {place.whatsappUrl && (
                  <a href={place.whatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 bg-muted/30 hover:bg-muted/60 transition-colors" title="WhatsApp">
                    <WhatsAppIcon size={20} />
                  </a>
                )}
              </div>
            )}

            {/* ── Recent Reviews ── */}
            {reviewSnippets.length > 0 && (
              <div className="border-t border-border/40 px-4 py-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <MessageCircle size={12} />
                  {isAr ? 'أحدث المراجعات' : 'Recent Reviews'}
                </div>
                {reviewSnippets.map((review: any, reviewIndex: number) => {
                  const parsed = parseReviewTitle(review.title);
                  return (
                    <div key={`${place.placeId || place.name || 'place'}-review-${reviewIndex}`} className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {parsed.author && (
                          <span className="text-xs font-semibold text-foreground">{parsed.author}</span>
                        )}
                        {typeof parsed.rating === 'number' && (
                          <StarRating value={parsed.rating} size={12} />
                        )}
                        {parsed.relTime && (
                          <span className="text-[11px] text-muted-foreground">{parsed.relTime}</span>
                        )}
                      </div>
                      {review.snippet && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {truncateReviewText(review.snippet, 200)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Google Maps all-places block ── */}
      {(searchEntryPointHtml || googleMapsSearchUrl) && (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-3 dark:bg-white/5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground" translate="no">
              Google Maps
            </div>
            {googleMapsSearchUrl && (
              <a
                href={googleMapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-400 underline"
                translate="no"
              >
                {isAr ? 'عرض كل الأماكن' : 'View all places'}
              </a>
            )}
          </div>
          {searchEntryPointHtml ? (
            <iframe
              title="Google Maps search entry"
              srcDoc={searchEntryPointHtml}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="w-full h-[160px] rounded-md border border-border/40 bg-background"
            />
          ) : googleMapsSearchUrl ? (
            <div className="rounded-md border border-border/40 bg-background/40 px-3 py-3 text-xs text-muted-foreground">
              <span>{isAr ? 'افتح Google Maps لرؤية كل الأماكن على الخريطة.' : 'Open Google Maps to view all places on the map.'}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
