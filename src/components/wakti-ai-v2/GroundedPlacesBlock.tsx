import React from 'react';

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

function normalizeEmailHref(value?: string) {
  const raw = (value || '').trim().replace(/^mailto:/i, '');
  if (!raw) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? `mailto:${raw}` : '';
}

function formatReviewCount(count?: number | null, language?: string) {
  if (typeof count !== 'number' || !Number.isFinite(count)) return '';
  return new Intl.NumberFormat(language === 'ar' ? 'ar-QA' : 'en-US').format(count);
}

function truncateReviewText(value?: string) {
  const text = (value || '').trim();
  if (!text) return '';
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function getGoogleMapsSearchUrl(resolvedBrowsingData: any, groundedPlaces: any[]) {
  const queries = Array.isArray(resolvedBrowsingData?.queries) ? resolvedBrowsingData.queries : [];
  const query = queries.find((value: unknown) => typeof value === 'string' && value.trim()) as string | undefined;
  if (query && query.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`;
  }
  return typeof groundedPlaces[0]?.mapsUrl === 'string' ? groundedPlaces[0].mapsUrl : '';
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

  return (
    <div className="space-y-3 pt-1">
      <div className="rounded-lg border border-border/50 bg-muted/10 p-3 dark:bg-white/5 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {language === 'ar' ? 'روابط ومراجعات موثقة' : 'Verified links and reviews'}
        </div>
        {groundedPlaces.slice(0, 6).map((place: any, index: number) => {
          const phoneHref = normalizePhoneHref(place.phone);
          const emailHref = normalizeEmailHref(place.email);
          const reviewSnippets = Array.isArray(place.reviewSnippets)
            ? place.reviewSnippets.filter((item: any) => item?.snippet || item?.googleMapsUri || item?.uri)
            : [];
          const socialLinks = [
            place.instagramUrl ? { key: 'instagram', label: language === 'ar' ? 'إنستغرام' : 'Instagram', url: place.instagramUrl } : null,
            place.facebookUrl ? { key: 'facebook', label: language === 'ar' ? 'فيسبوك' : 'Facebook', url: place.facebookUrl } : null,
            place.tiktokUrl ? { key: 'tiktok', label: language === 'ar' ? 'تيك توك' : 'TikTok', url: place.tiktokUrl } : null,
            place.whatsappUrl ? { key: 'whatsapp', label: language === 'ar' ? 'واتساب' : 'WhatsApp', url: place.whatsappUrl } : null,
          ].filter(Boolean) as Array<{ key: string; label: string; url: string }>;
          const hasUsefulLinks = Boolean(place.mapsUrl || phoneHref || emailHref || place.websiteUrl || socialLinks.length > 0);
          const hasSummaryMeta = typeof place.rating === 'number' || typeof place.userRatingCount === 'number' || typeof place.openNow === 'boolean';

          return (
            <div key={`${place.placeId || place.name || 'place'}-${index}`} className="rounded-lg border border-border/40 p-3 space-y-2">
              <div className="space-y-1">
                <div className="font-medium text-sm text-foreground">
                  {place.name || (language === 'ar' ? 'مكان' : 'Place')}
                </div>
                {place.address && (
                  <div className="text-xs text-muted-foreground">
                    {place.address}
                  </div>
                )}
              </div>
              {hasSummaryMeta && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {typeof place.rating === 'number' && (
                    <span>
                      {language === 'ar' ? 'التقييم' : 'Rating'}: {place.rating.toFixed(1)}
                    </span>
                  )}
                  {typeof place.userRatingCount === 'number' && (
                    <span>
                      {language === 'ar' ? 'المراجعات' : 'Reviews'}: {formatReviewCount(place.userRatingCount, language)}
                    </span>
                  )}
                  {typeof place.openNow === 'boolean' && (
                    <span>
                      {language === 'ar'
                        ? (place.openNow ? 'مفتوح الآن' : 'مغلق الآن')
                        : (place.openNow ? 'Open now' : 'Closed now')}
                    </span>
                  )}
                </div>
              )}
              {hasUsefulLinks && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {place.mapsUrl && (
                    <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border/50 px-2.5 py-1 text-blue-500 hover:text-blue-700 underline" translate="no">
                      Google Maps
                    </a>
                  )}
                  {phoneHref && (
                    <a href={phoneHref} className="rounded-full border border-border/50 px-2.5 py-1 text-blue-500 hover:text-blue-700 underline">
                      {language === 'ar' ? 'اتصال' : 'Call'}
                    </a>
                  )}
                  {emailHref && (
                    <a href={emailHref} className="rounded-full border border-border/50 px-2.5 py-1 text-blue-500 hover:text-blue-700 underline">
                      {language === 'ar' ? 'البريد' : 'Email'}
                    </a>
                  )}
                  {place.websiteUrl && (
                    <a href={place.websiteUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border/50 px-2.5 py-1 text-blue-500 hover:text-blue-700 underline">
                      {language === 'ar' ? 'الموقع' : 'Website'}
                    </a>
                  )}
                  {socialLinks.map((social) => (
                    <a key={`${place.placeId || place.name || 'place'}-${social.key}`} href={social.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border/50 px-2.5 py-1 text-blue-500 hover:text-blue-700 underline">
                      {social.label}
                    </a>
                  ))}
                </div>
              )}
              {reviewSnippets.length > 0 && (
                <details className="rounded-md border border-border/40 px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {language === 'ar' ? 'آخر مراجعتين من Google Maps' : 'Latest 2 Google Maps reviews'}
                  </summary>
                  <div className="mt-2 space-y-2">
                    {reviewSnippets.slice(0, 2).map((review: any, reviewIndex: number) => (
                      <div key={`${place.placeId || place.name || 'place'}-review-${reviewIndex}`} className="rounded-md border border-border/30 p-2 space-y-1">
                        <div className="text-foreground/90">
                          {truncateReviewText(review.snippet) || (language === 'ar' ? `مراجعة ${reviewIndex + 1}` : `Review ${reviewIndex + 1}`)}
                        </div>
                        {(review.googleMapsUri || review.uri) && (
                          <a
                            href={review.googleMapsUri || review.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 underline"
                            translate="no"
                          >
                            {review.title || `Google Maps ${language === 'ar' ? 'مصدر' : 'source'} ${reviewIndex + 1}`}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
      {(searchEntryPointHtml || googleMapsSearchUrl) && (
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3 dark:bg-white/5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground" translate="no">
              Google Maps
            </div>
            {googleMapsSearchUrl && (
              <a
                href={googleMapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-700 underline"
                translate="no"
              >
                {language === 'ar' ? 'عرض كل الأماكن' : 'View all places'}
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
              <span>{language === 'ar' ? 'افتح Google Maps لرؤية كل الأماكن على الخريطة.' : 'Open Google Maps to view all places on the map.'}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
