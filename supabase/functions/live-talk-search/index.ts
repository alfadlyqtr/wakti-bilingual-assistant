const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES') || Deno.env.get('GOOGLE_MAPS_API_KEY') || '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENAI_API_KEY') || '';

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  currentOpeningHours?: { openNow?: boolean };
  editorialSummary?: { text?: string };
};

type GeminiGroundingChunk = {
  web?: { uri?: string; title?: string };
};

function isPlaceQuery(query: string): boolean {
  return /(near me|nearest|closest|nearby|around me|restaurant|restaurants|cafe|cafes|coffee|hotel|pharmacy|hospital|clinic|gym|bank|atm|store|shop|mall|barber|salon|spa|bakery|burger|pizza|shawarma|mosque|beach|airport|station|مطعم|كافيه|قهوة|أقرب|قريب|بالقرب|حولي|فندق|صيدلية|مستشفى|عيادة|جيم|بنك|محل|مول|حلاق|صالون|مخبز|برغر|بيتزا|شاورما|مسجد|شاطئ|مطار|محطة)/i.test(query);
}

function buildLocationSuffix(city: string, country: string): string {
  if (city && country) return ` in ${city}, ${country}`;
  if (city) return ` in ${city}`;
  if (country) return ` in ${country}`;
  return '';
}

async function runPlacesSearch(query: string, location: { latitude?: number; longitude?: number; city?: string; country?: string }): Promise<{ context: string; results: GooglePlace[] }> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('Google Places key not configured');
  }

  const hasCoords = typeof location.latitude === 'number' && typeof location.longitude === 'number';
  const strictNearby = /(near me|nearest|closest|nearby|around me|أقرب|قريب|بالقرب|حولي)/i.test(query);
  const textQuery = `${query}${hasCoords ? '' : buildLocationSuffix(location.city || '', location.country || '')}`.trim();
  const body: Record<string, unknown> = { textQuery, maxResultCount: 5 };

  if (hasCoords) {
    const circle = {
      center: { latitude: location.latitude, longitude: location.longitude },
      radius: strictNearby ? 25000 : 30000,
    };
    if (strictNearby) {
      body.locationRestriction = { circle };
      body.rankPreference = 'DISTANCE';
    } else {
      body.locationBias = { circle };
    }
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.websiteUri,places.internationalPhoneNumber,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.currentOpeningHours,places.editorialSummary',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google Places error: ${response.status} ${errorText}`.trim());
  }

  const data = await response.json().catch(() => ({}));
  const results = Array.isArray(data?.places) ? data.places as GooglePlace[] : [];
  const topLines = results.slice(0, 5).map((place, index) => {
    const name = place.displayName?.text?.trim() || `Place ${index + 1}`;
    const address = place.formattedAddress?.trim() || '';
    const status = typeof place.currentOpeningHours?.openNow === 'boolean'
      ? (place.currentOpeningHours.openNow ? 'Open now' : 'Closed now')
      : (place.businessStatus?.trim() || 'Status unknown');
    const rating = typeof place.rating === 'number'
      ? `${place.rating.toFixed(1)}${typeof place.userRatingCount === 'number' ? ` (${place.userRatingCount} reviews)` : ''}`
      : '';
    const phone = place.internationalPhoneNumber?.trim() || place.nationalPhoneNumber?.trim() || '';
    const website = place.websiteUri?.trim() || '';
    const maps = place.googleMapsUri?.trim() || '';
    const summary = place.editorialSummary?.text?.replace(/\s+/g, ' ').trim() || '';

    return [
      `${index + 1}. ${name}`,
      address ? `   Address: ${address}` : '',
      rating ? `   Rating: ${rating}` : '',
      status ? `   Status: ${status}` : '',
      phone ? `   Phone: ${phone}` : '',
      website ? `   Website: ${website}` : '',
      maps ? `   Google Maps: ${maps}` : '',
      summary ? `   Summary: ${summary.slice(0, 220)}` : '',
    ].filter(Boolean).join('\n');
  });

  return {
    context: topLines.length ? `Top grounded Google place matches:\n${topLines.join('\n')}` : '',
    results,
  };
}

async function runGroundedGoogleSearch(query: string, language: string, city: string, country: string): Promise<{ context: string; results: Array<{ title: string; url: string }> }> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini key not configured');
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const locationHint = buildLocationSuffix(city, country);
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{
          text: language === 'ar'
            ? 'أنت طبقة بحث صوتية صغيرة داخل WAKTI. استخدم Google grounding فقط. أعطِ خلاصة قصيرة دقيقة مع مصادر مباشرة وبدون حشو.'
            : 'You are a compact voice-search layer inside WAKTI. Use Google grounding only. Give a short accurate summary with direct sources and no fluff.'
        }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: `${query}${locationHint} (as of ${today})` }]
      }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini search error: ${response.status} ${errorText}`.trim());
  }

  const data = await response.json().catch(() => ({}));
  const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  const answer = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts.map((part: { text?: string }) => typeof part?.text === 'string' ? part.text : '').join('').trim()
    : '';
  const chunks = Array.isArray(candidate?.groundingMetadata?.groundingChunks)
    ? candidate.groundingMetadata.groundingChunks as GeminiGroundingChunk[]
    : [];
  const sources = chunks
    .map((chunk) => ({ title: chunk?.web?.title?.trim() || '', url: chunk?.web?.uri?.trim() || '' }))
    .filter((item) => item.url)
    .filter((item, index, array) => array.findIndex((x) => x.url === item.url) === index)
    .slice(0, 5);

  const topLines = sources.map((source, index) => `${index + 1}. ${source.title || `Source ${index + 1}`} — ${source.url}`);
  return {
    context: [
      answer ? `Answer:\n${answer}` : '',
      topLines.length ? `Sources:\n${topLines.join('\n')}` : '',
    ].filter(Boolean).join('\n\n'),
    results: sources,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawQuery = typeof body?.query === 'string' ? body.query.trim() : '';
    const language = typeof body?.language === 'string' ? body.language : 'en';
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    const country = typeof body?.country === 'string' ? body.country.trim() : '';
    const latitude = typeof body?.latitude === 'number' ? body.latitude : undefined;
    const longitude = typeof body?.longitude === 'number' ? body.longitude : undefined;

    if (!rawQuery) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing query', context: '' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchResult = isPlaceQuery(rawQuery)
      ? await runPlacesSearch(rawQuery, { latitude, longitude, city, country })
      : await runGroundedGoogleSearch(rawQuery, language, city, country);

    return new Response(
      JSON.stringify({ success: true, context: searchResult.context, results: searchResult.results, language }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message, context: '' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
