const fs = require('fs');

function stripMarkdownText(value) {
  return value
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/gi, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([*_`\[\]()])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCleanString(value) {
  return typeof value === 'string' ? stripMarkdownText(value) : '';
}

function extractSegments(value) {
  const matches = Array.from(value.matchAll(/(Reason|Vibe|Must-?\s*Try|Status|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/gi));
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const label = match[1] || '';
    const valueStart = start + match[0].length;
    const valueEnd = index + 1 < matches.length ? (matches[index + 1].index ?? value.length) : value.length;
    return {
      label: label.toLowerCase().replace(/\s+/g, ''),
      value: value.slice(valueStart, valueEnd).trim(),
    };
  });
}

function createFallbackPlace(seed) {
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

function parsePlacesFromMessageContent(content) {
  const places = [];
  let current = null;
  const knownLabelPattern = /^(Reason|Vibe|Must-?\s*Try|Status|Google Maps|Maps(?: Link)?|Location|Phone|Website|Instagram|Facebook|TikTok|WhatsApp|Email|Rating|Google Reviews|Reviews|Social(?: Links?)?|Socials?)\s*:/i;

  const commit = () => {
    if (!current?.name) return;
    places.push(current);
    current = null;
  };

  for (const rawLine of (content || '').split('\n')) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    const isSegment = knownLabelPattern.test(trimmedLine.replace(/\*/g, '').trim());
    
    if (!isSegment) {
      const rawClean = trimmedLine.replace(/\*\*/g, '').trim();
      const startsWithBullet = /^(?:[-*•]|\d+\.)\s+(.*)$/.test(rawClean);
      
      if (startsWithBullet) {
        commit();
        
        let placeName = '';
        let address = '';
        let description = '';
        
        const boldMatches = trimmedLine.match(/\*\*([^*]+)\*\//g);
        const boldMatchesStandard = trimmedLine.match(/\*\*([^*]+)\*\*/g);
        const bestBoldMatches = boldMatchesStandard || boldMatches;
        
        if (bestBoldMatches && bestBoldMatches.length > 0) {
          const firstBold = bestBoldMatches[0].replace(/\*\*/g, '').trim();
          placeName = firstBold.replace(/^(?:[-*•]|\d+\.)\s+/, '').trim();
        }
        
        if (!placeName) {
          const contentWithoutBullet = rawClean.replace(/^(?:[-*•]|\d+\.)\s+/, '').trim();
          const parenIdx = contentWithoutBullet.indexOf('(');
          if (parenIdx !== -1) {
            placeName = contentWithoutBullet.slice(0, parenIdx).trim();
          } else {
            const parts = contentWithoutBullet.split(/[-–—,]/);
            placeName = parts[0].trim();
          }
        }
        
        const parenMatch = trimmedLine.match(/\(([^)]+)\)/);
        address = parenMatch ? parenMatch[1].trim() : '';
        
        const cleanContentLine = rawClean.replace(/^(?:[-*•]|\d+\.)\s+/, '').trim();
        description = cleanContentLine
          .replace(placeName, '')
          .replace(`(${address})`, '')
          .replace(/^[–-—\s,]+/, '')
          .trim();
          
        current = createFallbackPlace({
          name: toCleanString(placeName),
          address: toCleanString(address),
        });
        if (description) {
          current.editorialSummary = toCleanString(description);
        }
        continue;
      }
    }

    const rawValue = trimmedLine.trim();
    const segmentSource = rawValue.replace(/\*\*([^*]+)\*\//g, '$1').replace(/\*\*/g, '').trim();
    const line = toCleanString(segmentSource);
    if (!line) continue;

    const segments = extractSegments(segmentSource);
    if (!current || segments.length === 0) continue;

    for (const segment of segments) {
      const segmentRawValue = segment.value.replace(/^[-–—]\s*/, '').trim();
      const segmentValue = toCleanString(segmentRawValue);
      if (!segmentValue) continue;

      if (segment.label === 'reason') {
        current.reason = current.reason || segmentValue;
        continue;
      }
      if (segment.label === 'vibe') {
        current.vibe = current.vibe || segmentValue;
        continue;
      }
      if (segment.label === 'musttry' || segment.label === 'must-try') {
        current.mustTry = current.mustTry || segmentValue;
        continue;
      }
      if (segment.label === 'google maps' || segment.label === 'maps' || segment.label === 'maps link' || segment.label === 'location') {
        current.mapsUrl = current.mapsUrl || segmentValue;
        continue;
      }
      if (segment.label === 'status') {
        current.businessStatus = segmentValue;
        continue;
      }
    }
  }

  commit();
  return places;
}

const test1 = `Alfadly, here are some of the best-rated cafes in Doha right now for your next coffee run.

**1. Earth Organic Coffee** (Msheireb Downtown) A top-rated specialty coffee destination where you can smell and select your beans before they are brewed. It offers an immersive experience with expertly paired pastries in a refined, modern setting.
• **Vibe:** Immersive, specialty-focused, minimalist
• **Must Try:** Hand-brewed specialty coffee and paired artisan pastries
• **Status:** Open daily
• **Google Maps:** [Open in Maps](https://google.com/maps)

**2. BOHO Social** (Katara Cultural Village) Known for its chic, bohemian aesthetic, this spot features rattan lampshades, swinging chairs, and lush foliage. It is a highly popular destination for those looking for a picture-perfect hangout with great views.
`;

const res1 = parsePlacesFromMessageContent(test1);
console.log('TEST 1 (Bullet inside bold):', JSON.stringify(res1, null, 2));

const test2 = `1. **Harvest Coffee** (The Pearl-Qatar) Description text.
- **Vibe:** Green
- **Must Try:** Latte
`;
const res2 = parsePlacesFromMessageContent(test2);
console.log('TEST 2 (Bullet outside bold):', JSON.stringify(res2, null, 2));

const test3 = `1. Earth Organic Coffee (Msheireb Downtown) Plain text.
- **Vibe:** Cozy
- **Must Try:** Flat White
`;
const res3 = parsePlacesFromMessageContent(test3);
console.log('TEST 3 (Plain text, no bold):', JSON.stringify(res3, null, 2));
