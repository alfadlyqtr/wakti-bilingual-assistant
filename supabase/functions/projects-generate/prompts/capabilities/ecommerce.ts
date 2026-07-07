// Capability doc: E-COMMERCE / SHOP / PRODUCTS
//
// Phase A — Item A6 (token diet): the 40-line fetchProducts snippet was
// replaced with the API contract + mapping table. The model writes the React
// state, loading/empty states, and mapping from its training.

export const ECOMMERCE_CAPABILITY = `
## 🛒 E-COMMERCE / SHOP / PRODUCTS

🚨 The backend starts EMPTY — products and categories are NOT pre-seeded. You MUST fetch everything live — NEVER use a hardcoded \`mockData.js\` or a hardcoded categories array.

### BACKEND CONTRACTS
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

Fetch products:
{ projectId: "{{PROJECT_ID}}", action: "collection/products", data: { limit: 50 } }
→ { items: [{ id, data: { name, price, description, category, image_url, inStock }, created_at }, ...] }

Fetch categories (real ones the owner created in their Backend panel):
{ projectId: "{{PROJECT_ID}}", action: "collection/categories", data: { limit: 50 } }
→ { items: [{ id, data: { name }, created_at }, ...] }

Add to cart:
{ projectId: "{{PROJECT_ID}}", action: "cart/add", data: { sessionId: "guest-xxx", item: { id, name, price, quantity } } }

View cart:
{ projectId: "{{PROJECT_ID}}", action: "cart/get", data: { sessionId: "guest-xxx" } }

Create order:
{ projectId: "{{PROJECT_ID}}", action: "order/create", data: { items: [...], buyerInfo: { name, email, phone }, totalAmount } }
\`\`\`

### PRODUCT MAPPING (from backend \`item.data\` → UI)
| UI field | From | Fallback |
|---|---|---|
| name | \`item.data.name\` | "Product" |
| price | \`item.data.price\` | 0 |
| description | \`item.data.description\` | "" |
| category | \`item.data.category\` | "General" |
| image | \`item.data.image_url\` | \`getStaticPlaceholder(name, 400, 400)\` (from \`/utils/stockImages.js\`) |
| inStock | \`item.data.inStock !== false\` | \`true\` |

### 🚨 CATEGORIES MUST BE REAL, NEVER INVENTED (root cause of a confirmed production bug — do not repeat it)
A past generation hardcoded a categories array (\`['all', 'عود', 'عطور', 'مسك', 'مجموعات']\`) directly in \`Products.jsx\`, and separately hand-wrote category showcase cards in \`Home.jsx\`. The Backend Categories tab had zero matching records, and a manually-added real product silently vanished from search because the UI categories/filters were pure fiction disconnected from the database. NEVER repeat this pattern.
1. Compute the category list ONCE in \`AppContext.js\` and expose it from context — do not re-derive it separately in each page.
2. Category source priority: (a) real records from \`collection/categories\` if any exist → (b) otherwise the distinct \`category\` values found on real fetched products → (c) otherwise an empty list.
3. If the computed category list is empty, do NOT render a category filter bar or a "browse by category" showcase section at all — that section simply does not exist yet. Never fall back to invented category names.
4. Any price range/slider filter's max MUST be computed from real fetched product prices (e.g. \`Math.max(1000, ...products.map(p => Number(p.price) || 0))\`) — NEVER a fixed guess like a hardcoded \`max="1000"\`. A hardcoded ceiling silently hides any real product priced above it, with no indication to the shopper why.

### RULES
1. NEVER create \`/utils/mockData.js\` with hardcoded products.
2. Show loading skeletons while fetching; show a friendly empty state if no products.
3. Products have \`image_url\` — use it. Fall back to the stock-images placeholder.
4. Use a client-side \`sessionId\` (e.g., \`guest-<random>\`) stored in localStorage for cart operations.
5. If the backend returns zero products, DO NOT leave the shop or featured products sections blank.
6. For zero-product states, render a real empty state with a headline, helper text, and optional placeholder cards/skeleton cards labeled as coming soon — but NEVER fake real product names, prices, reviews, inventory, or categories.
7. Backend-driven sections must still preserve layout when empty so the page does not look broken or unfinished.

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- ❌ NEVER \`import { createClient } from '@supabase/supabase-js'\`
- ❌ NEVER include \`supabaseUrl\` / \`supabaseAnonKey\` in the generated app
- ✅ ALWAYS go through the project-backend-api endpoint
`;
