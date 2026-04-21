export const BLOG_CAPABILITY = `
## ✍️ BLOG / CMS / POSTS

🚨 Blog content should come from the backend collections. Do NOT hardcode blog posts in the React app.

### BACKEND CONTRACTS

\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

Fetch posts:
{ projectId: "{{PROJECT_ID}}", action: "collection/posts", data: { limit: 50 } }
→ { items: [{ id, data, created_at, updated_at }, ...] }

Fetch categories:
{ projectId: "{{PROJECT_ID}}", action: "collection/post_categories", data: { limit: 30 } }
→ { items: [{ id, data, created_at }, ...] }
\`\`\`

### POST FIELD MAPPING
| UI field | From |
|---|---|
| title | \`item.data.title\` |
| slug | \`item.data.slug\` |
| excerpt | \`item.data.excerpt\` |
| content | \`item.data.content\` |
| featured image | \`item.data.featured_image_url\` |
| category | \`item.data.category\` |
| tags | \`item.data.tags\` |
| author | \`item.data.author\` |
| published | \`item.data.published !== false\` |
| published date | \`item.data.published_at || item.created_at\` |

### CATEGORY FIELD MAPPING
| UI field | From |
|---|---|
| name | \`item.data.name\` |
| slug | \`item.data.slug\` |
| description | \`item.data.description\` |

### RULES
1. NEVER create \`mockData\` blog posts.
2. Show loading, empty, and error states for the blog list.
3. Filter the public blog index to published posts only.
4. Support both a blog list page and a post detail page using the post slug.
5. If categories exist, use them for filters or labels.
6. If \`featured_image_url\` is empty, show a graceful placeholder.
7. Keep blog rendering SEO-friendly: real headings, readable article layout, and clear publish metadata.

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- ❌ NEVER \`import { createClient } from '@supabase/supabase-js'\`
- ❌ NEVER include \`supabaseUrl\` / \`supabaseAnonKey\` in the generated app
- ✅ ALWAYS go through the project-backend-api endpoint
`;
