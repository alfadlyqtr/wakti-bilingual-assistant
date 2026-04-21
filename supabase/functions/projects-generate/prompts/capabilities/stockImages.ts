// Capability doc: FREEPIK STOCK IMAGES
// Loaded when the project needs any image (most projects).
//
// Phase A — Item A6 (token diet): verbose React helper code trimmed; only
// the API contract and rules remain. Modern models synthesize the React
// boilerplate from the schema.

export const STOCK_IMAGES_CAPABILITY = `
## 🖼️ STOCK IMAGES (FREEPIK API — MANDATORY)

### BANNED IMAGE SOURCES
- ❌ picsum.photos, unsplash.com, via.placeholder.com, placeholder.com, placehold.it
- ❌ Any hardcoded image URL, empty src=""

### MANDATORY FILE: /utils/stockImages.js
Create this file FIRST in every project. It must export three helpers:

| Export | Signature | Behavior |
|---|---|---|
| \`fetchStockImages\` | \`(query: string, limit=5) => Promise<string[]>\` | POST to BACKEND_URL with \`action: 'freepik/images'\`, return \`data.images[].url\`. On error or empty, fall back to \`getStaticPlaceholder\`. |
| \`useStockImage\` | \`(query: string) => { image: string; loading: boolean }\` | React hook: calls \`fetchStockImages(query, 1)\` on mount, returns first image with fallback. |
| \`getStaticPlaceholder\` | \`(query, w=400, h=300) => string\` | Returns \`https://placehold.co/{w}x{h}/1a1a2e/eaeaea?text={first-3-words}\`. |

### BACKEND CONTRACT
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api
Body: { projectId: "{{PROJECT_ID}}", action: "freepik/images", data: { query, limit } }
Response: { images: [{ url: string }, ...] }
\`\`\`

### USAGE PATTERNS
- Single image: \`const { image, loading } = useStockImage('barber shop interior');\`
- Multiple: \`useEffect(() => { fetchStockImages('services', 6).then(setImages); }, []);\`
- Static (no API call): \`<img src={getStaticPlaceholder('haircut', 400, 300)} />\`

### QUERY RULES (CRITICAL FOR RELEVANCE)
Extract KEY ENTITIES from the user's prompt (team, location, business type) and include them in every query.

✅ "Qatar national football team" → "Qatar national team", "Qatar football maroon jersey"
✅ "barber shop in Dubai" → "Dubai barber shop", "luxury barber interior"
❌ Generic "team", "business", "people" — ignores user context

### STRICT RULES
1. ALWAYS create /utils/stockImages.js FIRST before any image-using component.
2. ALWAYS import \`fetchStockImages\` / \`useStockImage\` / \`getStaticPlaceholder\` — do not inline fetch calls.
3. Include specific prompt terms in the query; use different queries per section (hero, about, services, gallery).
4. Rely on the placeholder fallback — no broken images ever.
`;
