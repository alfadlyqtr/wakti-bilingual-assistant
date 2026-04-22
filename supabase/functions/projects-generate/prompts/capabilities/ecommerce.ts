// Capability doc: E-COMMERCE / SHOP / PRODUCTS
//
// Phase A — Item A6 (token diet): the 40-line fetchProducts snippet was
// replaced with the API contract + mapping table. The model writes the React
// state, loading/empty states, and mapping from its training.

export const ECOMMERCE_CAPABILITY = `
## 🛒 E-COMMERCE / SHOP / PRODUCTS

🚨 Products are ALREADY seeded in the backend. You MUST fetch them — NEVER use hardcoded \`mockData.js\`.

### BACKEND CONTRACTS
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

Fetch products:
{ projectId: "{{PROJECT_ID}}", action: "collection/products", data: { limit: 50 } }
→ { items: [{ id, data: { name, price, description, category, image_url, inStock }, created_at }, ...] }

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

### RULES
1. NEVER create \`/utils/mockData.js\` with hardcoded products.
2. Show loading skeletons while fetching; show a friendly empty state if no products.
3. Products have \`image_url\` — use it. Fall back to the stock-images placeholder.
4. Use a client-side \`sessionId\` (e.g., \`guest-<random>\`) stored in localStorage for cart operations.
5. If the backend returns zero products, DO NOT leave the shop, featured products, collections, or category sections blank.
6. For zero-product states, render a real empty state with a headline, helper text, and optional placeholder cards/skeleton cards labeled as coming soon — but NEVER fake real product names, prices, reviews, or inventory.
7. Backend-driven sections must still preserve layout when empty so the page does not look broken or unfinished.

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- ❌ NEVER \`import { createClient } from '@supabase/supabase-js'\`
- ❌ NEVER include \`supabaseUrl\` / \`supabaseAnonKey\` in the generated app
- ✅ ALWAYS go through the project-backend-api endpoint
`;
