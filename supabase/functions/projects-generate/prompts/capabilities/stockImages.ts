// Capability doc: FREEPIK STOCK IMAGES
// Loaded when the project needs any image (most projects).

export const STOCK_IMAGES_CAPABILITY = `
## 🖼️ STOCK IMAGES (FREEPIK API — MANDATORY)

### BANNED IMAGE SOURCES
- ❌ picsum.photos, unsplash.com, via.placeholder.com, placeholder.com, placehold.it
- ❌ Any hardcoded image URL
- ❌ Empty src=""

### MANDATORY: Create /utils/stockImages.js in EVERY project

\`\`\`jsx
// /utils/stockImages.js — REQUIRED FILE
import React from 'react';

const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

const getPlaceholder = (query, width = 400, height = 300) => {
  const text = encodeURIComponent(query.split(' ').slice(0, 3).join(' '));
  return \`https://placehold.co/\${width}x\${height}/1a1a2e/eaeaea?text=\${text}\`;
};

export const fetchStockImages = async (query, limit = 5) => {
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '{{PROJECT_ID}}',
        action: 'freepik/images',
        data: { query, limit }
      })
    });
    const data = await res.json();
    const images = data.images?.map(img => img.url) || [];
    if (images.length === 0) return Array(limit).fill(null).map(() => getPlaceholder(query));
    return images;
  } catch (err) {
    console.error('Failed to fetch images:', err);
    return Array(limit).fill(null).map(() => getPlaceholder(query));
  }
};

export const useStockImage = (query) => {
  const [image, setImage] = React.useState(getPlaceholder(query));
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetchStockImages(query, 1).then(imgs => {
      setImage(imgs[0] || getPlaceholder(query));
      setLoading(false);
    });
  }, [query]);
  return { image, loading };
};

export const getStaticPlaceholder = getPlaceholder;
\`\`\`

### USAGE PATTERNS (EVERY COMPONENT WITH IMAGES)
\`\`\`jsx
import { fetchStockImages, useStockImage, getStaticPlaceholder } from '../utils/stockImages';

// Option 1: Hook for single images (with automatic fallback)
const { image: heroImage, loading } = useStockImage('barber shop interior');

// Option 2: Multiple images
const [images, setImages] = useState([]);
useEffect(() => { fetchStockImages('barber services', 6).then(setImages); }, []);

// Option 3: Static placeholder (no API call needed)
<img src={getStaticPlaceholder('haircut', 400, 300)} alt="Haircut" />
\`\`\`

### IMAGE SEARCH QUERIES — MUST MATCH USER'S PROMPT EXACTLY

Extract KEY ENTITIES from the user's prompt (team names, locations, business types) and use them in search queries.

**CORRECT:**
- User asks "Qatar national football team" → "Qatar national team", "Qatar football maroon jersey"
- User asks "barber shop in Dubai" → "Dubai barber shop", "luxury barber interior"
- User asks "Italian restaurant" → "Italian restaurant interior", "pasta dishes"

**WRONG:**
- Generic queries like "team", "business", "people" that ignore user context

### STRICT RULES
1. ALWAYS create /utils/stockImages.js FIRST before any component
2. ALWAYS import fetchStockImages / useStockImage / getStaticPlaceholder for any image
3. Query MUST include specific terms from user's prompt
4. Use different queries for different sections (hero, about, services)
5. Images will always show (placeholder fallback) — no broken images
`;
