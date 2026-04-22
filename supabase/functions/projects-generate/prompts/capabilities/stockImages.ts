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
Extract KEY ENTITIES from the user's prompt (product category, location, business type) and use them in every Freepik query.

✅ "Abayas & Fashion" → hero: "elegant abaya fashion model", products: "luxury abaya collection", about: "modest fashion designer"
✅ "barber shop" → hero: "barber shop interior modern", services: "haircut barber chair", team: "professional barber"
✅ "perfumes & oud" → hero: "luxury perfume bottle oud", products: "arabic oud perfume collection"
✅ "jewelry" → hero: "luxury gold jewelry display", products: "gold ring necklace bracelet"
✅ "restaurant" → hero: "restaurant interior elegant", menu: "food dish presentation gourmet"
✅ "fitness" → hero: "gym workout fitness", services: "personal trainer exercise"

❌ Generic "store", "products", "business", "people", "laptop", "technology" — NEVER use these for physical product stores
❌ NEVER use laptop/computer/phone images for fashion, food, or physical product sites

### MODEST FASHION / ABAYA RULES (MANDATORY)
- If the prompt mentions abaya, modest fashion, hijab fashion, jalabiya, or similar, the query MUST include the exact clothing category term (for example: "abaya").
- Prefer queries like "black abaya fashion model", "modest fashion boutique interior", "luxury abaya fabric detail", "elegant abaya collection rack".
- For hero sections, prefer people actually wearing the garment or boutique scenes that clearly show modest-fashion clothing.
- For product/category sections, prefer clothing racks, folded garments, fabric texture, tailoring, and product displays relevant to abayas/modest wear.
- NEVER drift into generic luxury gift boxes, handbags, perfume bottles, jewelry-only shots, laptops, phones, or abstract office imagery when the business is specifically abayas/modest fashion.

### CRITICAL: Match image to product type
- Fashion/clothing stores → models wearing the product, fabric textures, boutique interior
- Food/restaurant → actual food dishes, restaurant atmosphere, ingredients
- Beauty/salon → salon interior, beauty treatments, cosmetic products
- Fitness → gym equipment, workout sessions, healthy lifestyle
- Jewelry → close-up product shots, display cases, luxury styling

### STRICT RULES
1. ALWAYS create /utils/stockImages.js FIRST before any image-using component.
2. ALWAYS import \`fetchStockImages\` / \`useStockImage\` / \`getStaticPlaceholder\` — do not inline fetch calls.
3. Include specific prompt terms in the query; use different queries per section (hero, about, services, gallery).
4. Rely on the placeholder fallback — no broken images ever.
`;
