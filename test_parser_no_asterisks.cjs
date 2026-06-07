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

    const bulletMatch = trimmedLine.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bulletMatch) {
      const bulletContent = bulletMatch[1].trim();
      const boldNameMatch = bulletContent.match(/^\*\*([^*]+)\*\*(.*)$/);
      if (boldNameMatch && !knownLabelPattern.test(toCleanString(boldNameMatch[1]).trim() + ':')) {
        commit();
        const rawName = boldNameMatch[1].trim();
        const rest = boldNameMatch[2].trim();
        
        const areaMatch = rest.match(/^\(([^)]+)\)(.*)$/);
        const address = areaMatch ? areaMatch[1].trim() : '';
        const description = areaMatch ? areaMatch[2].trim() : rest;

        current = createFallbackPlace({
          name: toCleanString(rawName),
          address: toCleanString(address),
        });
        if (description) {
          current.editorialSummary = toCleanString(description);
        }
        continue;
      }
    }

    const rawValue = (bulletMatch?.[1] || trimmedLine).trim();
    const segmentSource = rawValue.replace(/\*\*([^*]+)\*\*/g, '$1').trim();
    const line = toCleanString(segmentSource);
    if (!line) continue;

    if (bulletMatch && !knownLabelPattern.test(line) && !line.includes(':')) {
      commit();
      current = createFallbackPlace({ name: line });
      continue;
    }

    const boldHeadingMatch = trimmedLine.match(/^\*\*([^*:]+)\*\*\s*$/);
    if (boldHeadingMatch && !knownLabelPattern.test(boldHeadingMatch[1].trim())) {
      commit();
      current = createFallbackPlace({ name: toCleanString(boldHeadingMatch[1]) });
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

const testText = `Alfadly, here are some of the best-rated cafes in Doha right now for your next coffee run.

1. Earth Organic Coffee (Msheireb Downtown) A top-rated specialty coffee destination where you can smell and select your beans before they are brewed. It offers an immersive experience with expertly paired pastries in a refined, modern setting.
• Vibe: Immersive, specialty-focused, minimalist
• Must Try: Hand-brewed specialty coffee and paired artisan pastries
• Status: Open daily
• Google Maps: Open in Maps

2. BOHO Social (Katara Cultural Village) Known for its chic, bohemian aesthetic, this spot features rattan lampshades, swinging chairs, and lush foliage. It is a highly popular destination for those looking for a picture-perfect hangout with great views.
`;

const res = parsePlacesFromMessageContent(testText);
console.log('PARSED PLACES:', JSON.stringify(res, null, 2));
