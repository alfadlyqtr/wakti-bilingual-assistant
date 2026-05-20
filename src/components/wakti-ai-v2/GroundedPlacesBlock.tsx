import React from 'react';
import { MapPin, Phone, Globe, Navigation, Star, MessageCircle, Mail } from 'lucide-react';

type MessageLike = {
  content?: string;
  browsingData?: any;
  metadata?: any;
};

export function resolveGroundedBrowsingData(message: MessageLike | null | undefined) {
  if (!message || typeof message !== 'object') return null;
  const candidates = [message.browsingData, message.metadata?.browsingData, message.metadata?.geminiSearch]
    .filter((item) => item && typeof item === 'object');
  if (candidates.length === 0) return null;

  const merged: any = {};
  const seenSourceUrls = new Set<string>();
  const seenPlaceKeys = new Set<string>();

  for (const candidate of candidates) {
    if (!merged.provider && typeof candidate.provider === 'string') merged.provider = candidate.provider;
    if (!merged.googleMapsWidgetContextToken && typeof candidate.googleMapsWidgetContextToken === 'string' && candidate.googleMapsWidgetContextToken.trim()) {
      merged.googleMapsWidgetContextToken = candidate.googleMapsWidgetContextToken;
    }
    if (!merged.searchEntryPointHtml && typeof candidate.searchEntryPointHtml === 'string' && candidate.searchEntryPointHtml.trim()) {
      merged.searchEntryPointHtml = candidate.searchEntryPointHtml;
    }

    if (Array.isArray(candidate.queries)) {
      merged.queries = Array.from(new Set([...(Array.isArray(merged.queries) ? merged.queries : []), ...candidate.queries.filter((item: unknown) => typeof item === 'string' && item.trim())]));
    }

    if (Array.isArray(candidate.supports)) {
      merged.supports = [...(Array.isArray(merged.supports) ? merged.supports : []), ...candidate.supports];
    }

    if (Array.isArray(candidate.sources)) {
      const nextSources = Array.isArray(merged.sources) ? [...merged.sources] : [];
      for (const source of candidate.sources) {
        const url = typeof source?.url === 'string' ? source.url.trim() : '';
        if (!url || seenSourceUrls.has(url)) continue;
        seenSourceUrls.add(url);
        nextSources.push(source);
      }
      merged.sources = nextSources;
    }

    if (Array.isArray(candidate.places)) {
      const nextPlaces = Array.isArray(merged.places) ? [...merged.places] : [];
      for (const place of candidate.places) {
        const placeKey = [place?.placeId, place?.name, place?.mapsUrl, place?.websiteUrl]
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
          .join('|');
        if (!placeKey || seenPlaceKeys.has(placeKey)) continue;
        seenPlaceKeys.add(placeKey);
        nextPlaces.push(place);
      }
      merged.places = nextPlaces;
    }
  }

  return merged;
}

function stripMarkdownText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/gi, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([*_`\[\]()])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCleanString(value?: unknown) {
  return typeof value === 'string' ? stripMarkdownText(value) : '';
}

function normalizePlaceKey(value?: unknown) {
  return toCleanString(value)
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractFirstLink(value: string) {
  const markdownMatch = value.match(/\[[^\]]+\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/i);
  if (markdownMatch?.[1]) return markdownMatch[1].trim();
  const directMatch = value.match(/(?:https?:\/\/|mailto:|tel:)[^\s)]+/i);
  if (directMatch?.[0]) return directMatch[0].trim();
  return '';
}

function extractAllLinks(value: string) {
  const found = new Set<string>();
  const markdownRegex = /\[[^\]]+\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/gi;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownRegex.exec(value)) !== null) {
    if (markdownMatch[1]) found.add(markdownMatch[1].trim());
  }
  const directMatches = value.match(/(?:https?:\/\/|mailto:|tel:)[^\s)]+/gi) || [];
  for (const match of directMatches) {
    found.add(match.trim());
  }
  return Array.from(found);
}

function getUrlHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function applyLinksToParsedPlace(place: any, value: string) {
  for (const url of extractAllLinks(value)) {
    const host = getUrlHost(url);
    if (!host) continue;

    if (!place.mapsUrl && ((host.includes('google.com') && url.includes('/maps')) || host === 'maps.app.goo.gl' || host === 'goo.gl')) {
      place.mapsUrl = url;
      continue;
    }
    if (!place.instagramUrl && host.endsWith('instagram.com')) {
      place.instagramUrl = url;
      continue;
    }
    if (!place.facebookUrl && host.endsWith('facebook.com')) {
      place.facebookUrl = url;
      continue;
    }
    if (!place.tiktokUrl && host.endsWith('tiktok.com')) {
      place.tiktokUrl = url;
      continue;
    }
    if (!place.whatsappUrl && (host === 'wa.me' || host.endsWith('whatsapp.com'))) {
      place.whatsappUrl = url;
      continue;
    }
    if (!place.websiteUrl && /^https?:\/\//i.test(url) && !host.includes('google.com')) {
      place.websiteUrl = url;
    }
  }
}

function extractLinkLabel(value: string) {
  const markdownMatch = value.match(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/i);
  if (markdownMatch?.[1]) return toCleanString(markdownMatch[1]);
  return toCleanString(value);
}

function formatPhoneDisplay(value?: string) {
  const cleaned = toCleanString(value);
  if (!cleaned) return '';
  const digits = cleaned.replace(/[^\d+]/g, '');
  if (!digits) return cleaned;
  if (digits.startsWith('+') && digits.length > 4) {
    const countryCode = digits.slice(0, 4);
    const rest = digits.slice(4);
    const groups = rest.match(/.{1,4}/g)?.join(' ') || rest;
    return `${countryCode} ${groups}`.trim();
  }
  return digits.match(/.{1,4}/g)?.join(' ') || digits;
}

function extractSegments(value: string) {
  const matches = Array.from(value.matchAll(/(Reason|Vibe|Must-?Try|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/gi));
  if (matches.length === 0) return [] as Array<{ label: string; value: string }>;
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const label = match[1] || '';
    const valueStart = start + match[0].length;
    const valueEnd = index + 1 < matches.length ? (matches[index + 1].index ?? value.length) : value.length;
    return {
      label: label.toLowerCase(),
      value: value.slice(valueStart, valueEnd).trim(),
    };
  });
}

function createFallbackPlace(seed: Record<string, unknown>) {
  return {
    placeId: '',
    name: toCleanString(seed.name),
    address: toCleanString(seed.address),
    latitude: null,
    longitude: null,
    rating: null,
    userRatingCount: null,
    websiteUrl: '',
    phone: '',
    email: '',
    openNow: null,
    businessStatus: '',
    reason: '',
    vibe: '',
    mustTry: '',
    editorialSummary: '',
    reviewSnippets: [],
    mapsUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    whatsappUrl: '',
  };
}

function parsePlacesFromMessageContent(content?: string) {
  const places: any[] = [];
  let current: any = null;
  const knownLabelPattern = /^(Reason|Vibe|Must-?Try|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/i;

  const commit = () => {
    if (!current?.name) return;
    places.push(current);
    current = null;
  };

  for (const rawLine of (content || '').split('\n')) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    const bulletMatch = trimmedLine.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    const rawValue = (bulletMatch?.[1] || trimmedLine).trim();
    const segmentSource = rawValue.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
    const line = toCleanString(segmentSource);
    if (!line) continue;

    if (bulletMatch && !knownLabelPattern.test(line) && !line.includes(':')) {
      commit();
      current = createFallbackPlace({ name: line });
      continue;
    }

    const segments = extractSegments(segmentSource);
    if (!current || segments.length === 0) continue;

    for (const segment of segments) {
      const segmentRawValue = segment.value.replace(/^[-–—]\s*/, '').trim();
      const segmentValue = toCleanString(segmentRawValue);
      if (!segmentValue) continue;

      if (segment.label === 'reason') {
        current.reason = current.reason || segmentValue;
        applyLinksToParsedPlace(current, segmentRawValue);
        continue;
      }
      if (segment.label === 'vibe') {
        current.vibe = current.vibe || segmentValue;
        applyLinksToParsedPlace(current, segmentRawValue);
        continue;
      }
      if (segment.label === 'must-try' || segment.label === 'musttry') {
        current.mustTry = current.mustTry || segmentValue;
        applyLinksToParsedPlace(current, segmentRawValue);
        continue;
      }
      if (segment.label === 'google maps' || segment.label === 'maps' || segment.label === 'maps link' || segment.label === 'location') {
        current.mapsUrl = current.mapsUrl || extractFirstLink(segmentRawValue);
        applyLinksToParsedPlace(current, segmentRawValue);
        continue;
      }
      if (segment.label === 'phone') {
        current.phone = current.phone || extractLinkLabel(segmentRawValue.replace(/^📞\s*/, '').trim());
        continue;
      }
      if (segment.label === 'website') {
        current.websiteUrl = current.websiteUrl || extractFirstLink(segmentRawValue) || segmentValue;
        applyLinksToParsedPlace(current, segmentRawValue);
        continue;
      }
      if (segment.label === 'instagram') {
        current.instagramUrl = current.instagramUrl || extractFirstLink(segmentRawValue) || segmentValue;
        continue;
      }
      if (segment.label === 'facebook') {
        current.facebookUrl = current.facebookUrl || extractFirstLink(segmentRawValue) || segmentValue;
        continue;
      }
      if (segment.label === 'tiktok') {
        current.tiktokUrl = current.tiktokUrl || extractFirstLink(segmentRawValue) || segmentValue;
        continue;
      }
      if (segment.label === 'whatsapp') {
        current.whatsappUrl = current.whatsappUrl || extractFirstLink(segmentRawValue) || segmentValue;
        continue;
      }
      if (segment.label === 'social' || segment.label === 'social links' || segment.label === 'socials') {
        applyLinksToParsedPlace(current, segmentRawValue);
        continue;
      }
      if (segment.label === 'email') {
        current.email = current.email || extractLinkLabel(segmentRawValue);
        continue;
      }
      if (segment.label === 'rating') {
        const ratingMatch = segmentValue.match(/\d+(?:\.\d+)?/);
        if (ratingMatch?.[0]) current.rating = Number(ratingMatch[0]);
        continue;
      }
      if (segment.label === 'google reviews' || segment.label === 'reviews') {
        const reviewsMatch = segmentValue.match(/[\d,]+/);
        if (reviewsMatch?.[0]) current.userRatingCount = Number(reviewsMatch[0].replace(/,/g, ''));
      }
    }
  }

  commit();
  return places;
}

function mergeGroundedPlaceData(existingPlace: any, parsedPlace: any) {
  return {
    ...existingPlace,
    name: toCleanString(existingPlace?.name) || toCleanString(parsedPlace?.name),
    address: toCleanString(existingPlace?.address) || toCleanString(parsedPlace?.address),
    rating: typeof existingPlace?.rating === 'number' ? existingPlace.rating : (typeof parsedPlace?.rating === 'number' ? parsedPlace.rating : null),
    userRatingCount: typeof existingPlace?.userRatingCount === 'number' ? existingPlace.userRatingCount : (typeof parsedPlace?.userRatingCount === 'number' ? parsedPlace.userRatingCount : null),
    websiteUrl: toCleanString(existingPlace?.websiteUrl) || toCleanString(parsedPlace?.websiteUrl),
    phone: toCleanString(existingPlace?.phone) || toCleanString(parsedPlace?.phone),
    email: toCleanString(existingPlace?.email) || toCleanString(parsedPlace?.email),
    reason: toCleanString(existingPlace?.reason) || toCleanString(parsedPlace?.reason),
    vibe: toCleanString(existingPlace?.vibe) || toCleanString(parsedPlace?.vibe),
    mustTry: toCleanString(existingPlace?.mustTry) || toCleanString(parsedPlace?.mustTry),
    editorialSummary: toCleanString(existingPlace?.editorialSummary) || toCleanString(parsedPlace?.editorialSummary),
    mapsUrl: toCleanString(existingPlace?.mapsUrl) || toCleanString(parsedPlace?.mapsUrl),
    instagramUrl: toCleanString(existingPlace?.instagramUrl) || toCleanString(parsedPlace?.instagramUrl),
    facebookUrl: toCleanString(existingPlace?.facebookUrl) || toCleanString(parsedPlace?.facebookUrl),
    tiktokUrl: toCleanString(existingPlace?.tiktokUrl) || toCleanString(parsedPlace?.tiktokUrl),
    whatsappUrl: toCleanString(existingPlace?.whatsappUrl) || toCleanString(parsedPlace?.whatsappUrl),
    reviewSnippets: Array.isArray(existingPlace?.reviewSnippets) && existingPlace.reviewSnippets.length > 0
      ? existingPlace.reviewSnippets
      : (Array.isArray(parsedPlace?.reviewSnippets) ? parsedPlace.reviewSnippets : []),
  };
}

export function getGroundedPlaces(message: MessageLike | null | undefined): any[] {
  const resolvedBrowsingData = resolveGroundedBrowsingData(message);
  const backendPlaces = Array.isArray(resolvedBrowsingData?.places) ? resolvedBrowsingData.places : [];
  const parsedPlaces = parsePlacesFromMessageContent(message?.content);

  if (backendPlaces.length === 0) return parsedPlaces;
  if (parsedPlaces.length === 0) return backendPlaces;

  const mergedPlaces = [...backendPlaces];
  for (const parsedPlace of parsedPlaces) {
    const parsedKey = normalizePlaceKey(parsedPlace?.name);
    const matchIndex = mergedPlaces.findIndex((existingPlace: any) => {
      const existingKey = normalizePlaceKey(existingPlace?.name);
      return Boolean(parsedKey && existingKey && (parsedKey === existingKey || parsedKey.includes(existingKey) || existingKey.includes(parsedKey)));
    });

    if (matchIndex >= 0) {
      mergedPlaces[matchIndex] = mergeGroundedPlaceData(mergedPlaces[matchIndex], parsedPlace);
      continue;
    }

    mergedPlaces.push(parsedPlace);
  }

  return mergedPlaces;
}

export function hasGroundedPlaces(message: MessageLike | null | undefined) {
  const places = getGroundedPlaces(message);
  if (places.length === 0) return false;
  return places.some((p: any) => {
    const phoneHref = normalizePhoneHref(p.phone);
    const emailHref = normalizeEmailHref(p.email);
    const hasRating = typeof p.rating === 'number';
    const hasPhone = Boolean(phoneHref);
    const hasEmail = Boolean(emailHref);
    const hasAddress = Boolean(p.address && p.address.trim());
    const hasPlaceId = Boolean(p.placeId && p.placeId.trim());
    const hasWebsite = Boolean(p.websiteUrl && p.websiteUrl.trim());
    const hasMaps = Boolean(p.mapsUrl && p.mapsUrl.trim());
    const hasReason = Boolean(p.reason && p.reason.trim());
    const hasVibe = Boolean(p.vibe && p.vibe.trim());
    const hasMustTry = Boolean(p.mustTry && p.mustTry.trim());
    const hasSocials = Boolean(p.instagramUrl || p.facebookUrl || p.tiktokUrl || p.whatsappUrl);
    const hasReviews = Array.isArray(p.reviewSnippets) && p.reviewSnippets.some((r: any) => r?.snippet);
    return hasRating || hasPhone || hasEmail || hasWebsite || hasMaps || hasReason || hasVibe || hasMustTry || (hasPlaceId && hasAddress) || (hasSocials && hasAddress) || (hasReviews && hasAddress);
  });
}

function normalizePhoneHref(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function normalizeEmailHref(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? `mailto:${raw}` : '';
}

function getWebsiteLabel(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.hostname.replace(/^www\./i, '');
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || raw;
  }
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

function extractPlacesIntro(content?: string) {
  if (!content) return '';
  const introLines: string[] = [];
  const knownLabelPattern = /^(Reason|Vibe|Must-?Try|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/i;
  for (const rawLine of content.split('\n')) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;
    if (/^(?:[-*•]|\d+\.)\s+/.test(trimmedLine)) break;
    const cleanedLine = stripMarkdownText(trimmedLine);
    if (!cleanedLine) continue;
    if (knownLabelPattern.test(cleanedLine)) break;
    introLines.push(cleanedLine);
    if (introLines.length >= 2) break;
  }
  const intro = introLines.join(' ').replace(/\s+/g, ' ').trim();
  if (!intro) return '';
  return intro.length > 220 ? `${intro.slice(0, 217)}...` : intro;
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
  const parts = toCleanString(title).split('·').map((p) => p.trim());
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
  const groundedPlaces = getGroundedPlaces(message);
  const searchEntryPointHtml = typeof resolvedBrowsingData?.searchEntryPointHtml === 'string'
    ? resolvedBrowsingData.searchEntryPointHtml.trim()
    : '';
  const googleMapsSearchUrl = getGoogleMapsSearchUrl(resolvedBrowsingData, groundedPlaces);
  const introText = extractPlacesIntro(message?.content);

  if (groundedPlaces.length === 0) return null;

  const isAr = language === 'ar';

  // Only show cards that have at least one meaningful field beyond just name+mapsUrl
  const richPlaces = groundedPlaces.slice(0, 6).filter((place: any) => {
    const phoneHref = normalizePhoneHref(place.phone);
    const emailHref = normalizeEmailHref(place.email);
    const hasRating = typeof place.rating === 'number';
    const hasAddress = Boolean(place.address && place.address.trim());
    const hasPhone = Boolean(phoneHref);
    const hasEmail = Boolean(emailHref);
    const hasWeb = Boolean(place.websiteUrl && place.websiteUrl.trim());
    const hasMaps = Boolean(place.mapsUrl && place.mapsUrl.trim());
    const hasReason = Boolean(place.reason && place.reason.trim());
    const hasVibe = Boolean(place.vibe && place.vibe.trim());
    const hasMustTry = Boolean(place.mustTry && place.mustTry.trim());
    const hasSocials = Boolean(place.instagramUrl || place.facebookUrl || place.tiktokUrl || place.whatsappUrl);
    const hasReviews = Array.isArray(place.reviewSnippets) && place.reviewSnippets.some((r: any) => r?.snippet);
    const hasEditorial = Boolean(place.editorialSummary && place.editorialSummary.trim());
    // Must have meaningful data — rating or phone is ideal, but placeId+address is enough
    // (fetchGooglePlaceDetails will have enriched it if GOOGLE_MAPS_API_KEY is set)
    const hasPlaceId = Boolean(place.placeId && place.placeId.trim());
    return hasRating || hasPhone || hasEmail || hasWeb || hasMaps || hasReason || hasVibe || hasMustTry || hasEditorial || (hasPlaceId && hasAddress) || (hasSocials && hasAddress) || (hasReviews && hasAddress);
  });
  const displayPlaces = richPlaces.length > 0
    ? richPlaces
    : groundedPlaces.slice(0, 6).filter((place: any) => {
        const hasName = Boolean(place?.name && String(place.name).trim());
        const hasAddress = Boolean(place?.address && String(place.address).trim());
        const hasMaps = Boolean(place?.mapsUrl && String(place.mapsUrl).trim());
        const hasWeb = Boolean(place?.websiteUrl && String(place.websiteUrl).trim());
        const hasPhone = Boolean(normalizePhoneHref(place?.phone));
        const hasEmail = Boolean(normalizeEmailHref(place?.email));
        const hasSocials = Boolean(place?.instagramUrl || place?.facebookUrl || place?.tiktokUrl || place?.whatsappUrl);
        return hasName && (hasAddress || hasMaps || hasWeb || hasPhone || hasEmail || hasSocials);
      });

  // If no place has rich data, skip the entire block — the written text is enough
  if (displayPlaces.length === 0) {
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
      {displayPlaces.map((place: any, index: number) => {
        const phoneHref = normalizePhoneHref(place.phone);
        const emailHref = normalizeEmailHref(place.email);
        const reviewSnippets = Array.isArray(place.reviewSnippets)
          ? place.reviewSnippets.filter((item: any) => item?.snippet || item?.googleMapsUri || item?.uri).slice(0, 4)
          : [];
        const hasMaps = Boolean(place.mapsUrl && String(place.mapsUrl).trim());
        const hasCall = Boolean(phoneHref);
        const hasEmail = Boolean(emailHref);
        const hasWeb = Boolean(place.websiteUrl && place.websiteUrl.trim());
        const hasWhatsApp = Boolean(place.whatsappUrl && place.whatsappUrl.trim());
        const hasSocials = Boolean(place.instagramUrl || place.facebookUrl || place.tiktokUrl || place.whatsappUrl);
        const websiteLabel = getWebsiteLabel(place.websiteUrl);
        const reasonText = toCleanString(place.reason);
        const vibeText = toCleanString(place.vibe);
        const mustTryText = toCleanString(place.mustTry);
        const placeName = toCleanString(place.name) || (isAr ? 'مكان' : 'Place');
        const addressText = toCleanString(place.address);
        const editorialSummary = toCleanString(place.editorialSummary);
        const phoneText = formatPhoneDisplay(place.phone);
        const emailText = toCleanString(place.email);
        const mapsUrl = toCleanString(place.mapsUrl);
        const websiteUrl = toCleanString(place.websiteUrl);
        const ratingText = typeof place.rating === 'number' ? place.rating.toFixed(1) : (isAr ? 'غير متوفر' : 'Not available');
        const reviewCountText = typeof place.userRatingCount === 'number'
          ? formatReviewCount(place.userRatingCount, language)
          : (isAr ? 'غير متوفر' : 'Not available');
        const socialLinks = [
          place.instagramUrl ? { label: 'Instagram', url: toCleanString(place.instagramUrl) } : null,
          place.facebookUrl ? { label: 'Facebook', url: toCleanString(place.facebookUrl) } : null,
          place.tiktokUrl ? { label: 'TikTok', url: toCleanString(place.tiktokUrl) } : null,
          place.whatsappUrl ? { label: 'WhatsApp', url: toCleanString(place.whatsappUrl) } : null,
        ].filter(Boolean) as Array<{ label: string; url: string }>;

        return (
          <div
            key={`${place.placeId || place.name || 'place'}-${index}`}
            className="rounded-2xl overflow-hidden shadow-md border border-white/10 dark:border-white/8"
            style={{ background: 'linear-gradient(145deg, hsl(235 25% 10%) 0%, hsl(240 20% 13%) 100%)' }}
          >
            {/* ── Header strip ── */}
            <div className="px-4 pt-4 pb-3">
              {index === 0 && introText && (
                <div className="mb-3 rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                  <div className="text-[13px] text-white/75 leading-relaxed">{introText}</div>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                    style={{ background: 'linear-gradient(135deg, hsl(210 100% 50%) 0%, hsl(260 70% 55%) 100%)' }}>
                    🏪
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[15px] text-white leading-tight">
                      {placeName}
                    </div>
                    {addressText && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="shrink-0 text-white/40" />
                        <span className="text-[11px] text-white/50 truncate">{addressText}</span>
                      </div>
                    )}
                  </div>
                </div>
                {typeof place.openNow === 'boolean' && (
                  <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    place.openNow
                      ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                      : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                  }`}>
                    {isAr ? (place.openNow ? 'مفتوح' : 'مغلق') : (place.openNow ? 'Open' : 'Closed')}
                  </span>
                )}
              </div>

              {/* Rating row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <div className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-white/75 ring-1 ring-white/10">
                  {isAr ? 'التقييم' : 'Rating'}: {ratingText}
                </div>
                <div className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-white/75 ring-1 ring-white/10">
                  {isAr ? 'عدد المراجعات' : 'Review count'}: {reviewCountText}
                </div>
              </div>

              {/* Editorial summary */}
              {editorialSummary && (
                <p className="text-[13px] text-white/60 leading-relaxed mb-2 whitespace-pre-line">
                  {editorialSummary}
                </p>
              )}

              {(reasonText || vibeText || mustTryText) && (
                <div className="space-y-2 mb-2">
                  {reasonText && (
                    <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                      <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">{isAr ? 'السبب' : 'Reason'}</div>
                      <div className="text-[13px] text-white/75 leading-relaxed">{reasonText}</div>
                    </div>
                  )}
                  {vibeText && (
                    <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                      <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">{isAr ? 'الأجواء' : 'Vibe'}</div>
                      <div className="text-[13px] text-white/75 leading-relaxed">{vibeText}</div>
                    </div>
                  )}
                  {mustTryText && (
                    <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                      <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">{isAr ? 'لازم تجربه' : 'Must-try'}</div>
                      <div className="text-[13px] text-white/75 leading-relaxed">{mustTryText}</div>
                    </div>
                  )}
                </div>
              )}

              {typeof place.userRatingCount === 'number' && typeof place.rating !== 'number' && (
                <div className="mb-2 inline-flex items-center rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-white/55 ring-1 ring-white/10">
                  {formatReviewCount(place.userRatingCount, language)} {isAr ? 'مراجعة Google' : 'Google reviews'}
                </div>
              )}

              {/* Phone row */}
              <div className="space-y-2 mb-2">
                <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                  <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">{isAr ? 'الهاتف' : 'Phone'}</div>
                  {phoneHref ? (
                    <a href={phoneHref} className="text-[13px] font-medium text-blue-300 hover:text-blue-200 transition-colors">
                      {phoneText}
                    </a>
                  ) : (
                    <div className="text-[13px] text-white/45">{isAr ? 'غير متوفر' : 'Not available'}</div>
                  )}
                </div>
                <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                  <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">{isAr ? 'الإيميل' : 'Email'}</div>
                  {emailHref ? (
                    <a href={emailHref} className="text-[13px] font-medium text-blue-300 hover:text-blue-200 transition-colors break-all">
                      {emailText}
                    </a>
                  ) : (
                    <div className="text-[13px] text-white/45">{isAr ? 'غير متوفر' : 'Not available'}</div>
                  )}
                </div>
                <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                  <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">{isAr ? 'الموقع' : 'Website'}</div>
                  {hasWeb ? (
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-blue-300 hover:text-blue-200 transition-colors break-all">
                      {websiteLabel || websiteUrl}
                    </a>
                  ) : (
                    <div className="text-[13px] text-white/45">{isAr ? 'غير متوفر' : 'Not available'}</div>
                  )}
                </div>
                <div className="rounded-xl bg-white/6 px-3 py-2 ring-1 ring-white/8">
                  <div className="text-[10px] uppercase tracking-widest text-white/35 mb-1">Google Maps</div>
                  {hasMaps ? (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-blue-300 hover:text-blue-200 transition-colors break-all">
                      {isAr ? 'افتح في Google Maps' : 'Open in Google Maps'}
                    </a>
                  ) : (
                    <div className="text-[13px] text-white/45">{isAr ? 'غير متوفر' : 'Not available'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Action buttons ── */}
            {(hasMaps || hasCall || hasEmail || hasWeb || hasWhatsApp) && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {hasMaps && (
                  <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="min-w-[110px] flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, hsl(210 100% 45%) 0%, hsl(220 90% 38%) 100%)' }}>
                    <Navigation size={13} />
                    {isAr ? 'الخريطة' : 'Maps'}
                  </a>
                )}
                {hasCall && (
                  <a href={phoneHref}
                    className="min-w-[110px] flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, hsl(142 76% 36%) 0%, hsl(150 70% 28%) 100%)' }}>
                    <Phone size={13} />
                    {isAr ? 'اتصال' : 'Call'}
                  </a>
                )}
                {hasEmail && (
                  <a href={emailHref}
                    className="min-w-[110px] flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, hsl(210 80% 56%) 0%, hsl(235 75% 44%) 100%)' }}>
                    <Mail size={13} />
                    {isAr ? 'إيميل' : 'Email'}
                  </a>
                )}
                {hasWhatsApp && (
                  <a href={place.whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="min-w-[110px] flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, hsl(142 76% 42%) 0%, hsl(160 75% 30%) 100%)' }}>
                    <MessageCircle size={13} />
                    WhatsApp
                  </a>
                )}
                {hasWeb && (
                  <a href={place.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="min-w-[110px] flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, hsl(280 60% 45%) 0%, hsl(270 55% 35%) 100%)' }}>
                    <Globe size={13} />
                    {isAr ? 'الموقع' : 'Website'}
                  </a>
                )}
              </div>
            )}

            {/* ── Social follow badges ── */}
            <div className="px-4 pb-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
              <span className="text-[11px] text-white/40 font-medium mr-1">{isAr ? 'روابط السوشال:' : 'Social links:'}</span>
              {socialLinks.length > 0 ? socialLinks.map((social) => (
                <a key={social.label} href={social.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 hover:opacity-80 transition-opacity active:scale-95 text-white/85 text-xs"
                  style={{ background: 'rgba(255,255,255,0.08)' }} title={social.label}>
                  {social.label === 'Instagram' ? <InstagramIcon size={22} /> : null}
                  {social.label === 'Facebook' ? <FacebookIcon size={22} /> : null}
                  {social.label === 'TikTok' ? <TikTokIcon size={22} /> : null}
                  {social.label === 'WhatsApp' ? <WhatsAppIcon size={22} /> : null}
                  <span>{social.label}</span>
                </a>
              )) : (
                <span className="text-[12px] text-white/45">{isAr ? 'غير متوفرة' : 'Not available'}</span>
              )}
            </div>

            {/* ── Recent Reviews ── */}
            {reviewSnippets.length > 0 && (
              <div className="border-t border-white/8 px-4 py-3 space-y-3"
                style={{ background: 'rgba(0,0,0,0.15)' }}>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/35 font-semibold">
                  <MessageCircle size={11} />
                  {isAr ? 'مراجعات Google' : 'Google Reviews'}
                </div>
                {reviewSnippets.map((review: any, reviewIndex: number) => {
                  const parsed = parseReviewTitle(review.title);
                  return (
                    <div key={`${place.placeId || place.name || 'place'}-review-${reviewIndex}`} className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {parsed.author && (
                          <span className="text-xs font-semibold text-white/80">{parsed.author}</span>
                        )}
                        {typeof parsed.rating === 'number' && (
                          <span className="text-[11px] text-white/55">{parsed.rating.toFixed(1)}/5</span>
                        )}
                        {parsed.relTime && (
                          <span className="text-[11px] text-white/35">{parsed.relTime}</span>
                        )}
                      </div>
                      {review.snippet && (
                        <p className="text-[12px] text-white/55 leading-relaxed">
                          {truncateReviewText(toCleanString(review.snippet), 200)}
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
