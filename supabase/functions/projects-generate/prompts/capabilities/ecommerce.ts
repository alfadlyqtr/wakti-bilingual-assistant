// Capability doc: E-COMMERCE / SHOP / PRODUCTS

export const ECOMMERCE_CAPABILITY = `
## 🛒 E-COMMERCE / SHOP / PRODUCTS

🚨 Products are ALREADY seeded in the backend. You MUST fetch them from the API — NEVER use hardcoded mockData.

### FETCH PRODUCTS FROM BACKEND

\`\`\`jsx
const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchProducts = async () => {
    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: '{{PROJECT_ID}}',
          action: 'collection/products',
          data: { limit: 50 }
        })
      });
      const data = await res.json();
      if (data.items) {
        setProducts(data.items.map(item => ({
          id: item.id,
          name: item.data?.name || 'Product',
          price: item.data?.price || 0,
          description: item.data?.description || '',
          category: item.data?.category || 'General',
          image: item.data?.image_url || getPlaceholder(item.data?.name || 'product'),
          inStock: item.data?.inStock !== false
        })));
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };
  fetchProducts();
}, []);

const getPlaceholder = (name, w = 400, h = 400) => {
  const text = encodeURIComponent(name.split(' ').slice(0, 2).join(' '));
  return \`https://placehold.co/\${w}x\${h}/1a1a2e/eaeaea?text=\${text}\`;
};
\`\`\`

### E-COMMERCE RULES
1. DO NOT create /utils/mockData.js with hardcoded products
2. ALWAYS fetch products from the backend API
3. Products have \`image_url\` in their data — use it
4. Show loading skeleton while fetching
5. Handle empty state if no products returned
6. Sample products are seeded automatically — they will appear

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- NEVER import \`@supabase/supabase-js\` in generated user projects
- NEVER add supabaseUrl or supabaseAnonKey to frontend code
- ALWAYS use the project-backend-api endpoint
`;
