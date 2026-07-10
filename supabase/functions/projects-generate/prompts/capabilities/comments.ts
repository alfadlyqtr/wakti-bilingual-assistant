export const COMMENTS_CAPABILITY = `
## 💬 COMMENTS / REVIEWS / DISCUSSIONS

Use this for blog post comments, product reviews, or any "leave a comment" feature. Comments are real backend records — NEVER fake them with local-only React state that resets on refresh.

### BACKEND CONTRACTS
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

List comments for an item:
{ projectId: "{{PROJECT_ID}}", action: "comments/list", data: { itemType: "post" | "product" | string, itemId: string, limit: 50 } }
→ { comments: [{ id, item_type, item_id, content, site_user_id, author_name, parent_id, created_at }, ...] }

Add a comment:
{ projectId: "{{PROJECT_ID}}", action: "comments/add", data: { itemType: string, itemId: string, content: string, authorName?: string, siteUserId?: string, parentId?: string } }
→ { comment: {...} }

Delete a comment (owner/moderation only):
{ projectId: "{{PROJECT_ID}}", action: "comments/delete", data: { commentId: string } }
→ { success: true }
\`\`\`

### REQUIRED BEHAVIOR
- \`itemType\` + \`itemId\` identify what's being commented on (e.g. a blog post's id, a product's id). Always pass both.
- If the site has site-user auth (see Authentication capability), pass the logged-in user's id as \`siteUserId\` and their name as \`authorName\`. If the site has no accounts, still collect a name field and submit with \`siteUserId\` omitted.
- \`parentId\` makes a comment a threaded reply — pass it when replying, omit it for a top-level comment.
- Fetch comments from \`comments/list\` on mount. Never seed the list with hardcoded example comments.
- Show loading, empty ("Be the first to comment"), and error states.
- After a successful add, append the new comment to the list and clear the input.

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- ❌ NEVER \`import { createClient } from '@supabase/supabase-js'\`
- ❌ NEVER include \`supabaseUrl\` / \`supabaseAnonKey\` in the generated app
- ✅ ALWAYS go through the project-backend-api endpoint
`;
