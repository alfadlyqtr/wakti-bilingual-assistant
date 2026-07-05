// Capability doc: AI GENERATED IMAGES (NANO-BANANA-2-LITE)
// Loaded when the project needs any image (most projects).

export const STOCK_IMAGES_CAPABILITY = `
## 🖼️ AI IMAGES (NANO-BANANA-2-LITE — MANDATORY)

### BANNED IMAGE SOURCES
- ❌ picsum.photos, unsplash.com, via.placeholder.com, placeholder.com, placehold.it
- ❌ Freepik and other stock provider runtime calls
- ❌ Empty src="" or fake broken image paths

### IMAGE SOURCE POLICY
- The system pre-generates image assets using **model: nano-banana-2-lite**.
- When pre-generated URLs are provided in the prompt, use those URLs directly.
- Use different image URLs per section (hero/about/services/gallery).
- If no generated URL is available for a section, use a minimal neutral fallback and keep structure ready for future image replacement.

### STRICT RULES
1. NEVER generate Freepik/stock helper files (no \`/utils/stockImages.js\`).
2. NEVER add API calls to Freepik in generated frontend code.
3. Prefer pre-generated image URLs provided in the creation prompt.
4. Match image composition to section purpose (hero wide, cards balanced, galleries diverse).
5. Keep imagery aligned with business domain and tone (luxury, medical, restaurant, etc.).

### HERO IMAGE QUALITY BAR
- Hero image must look premium and clearly connected to the business.
- Avoid generic office/laptop imagery unless the business is explicitly tech/SaaS.
- For product-led brands, use product-led visuals, not random people-first shots.

### SECTION-BY-SECTION THINKING
- Hero → strongest brand-defining visual, high impact.
- About → team/founder/brand environment.
- Services → process/tools/service action.
- Products → close-up product visuals and realistic usage.
- Contact → location/storefront/brand context image.

### IMAGE PLACEMENT DISCIPLINE
- Every section that needs an image MUST have one from the pre-generated set.
- If a pre-generated image does not perfectly match a section's label, use it anyway — match by VIBE, not by label. A tech workspace photo works for hero, about, and team if the composition fits.
- Never leave an image slot empty or broken. Work creatively with what you have.
- Never render a broken src or an empty image container. Choose the closest URL and use it.
`;
