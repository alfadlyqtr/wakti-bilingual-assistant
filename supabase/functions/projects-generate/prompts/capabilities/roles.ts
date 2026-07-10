export const ROLES_CAPABILITY = `
## 🔐 USER ROLES / PERMISSIONS / TEAM ACCESS

Use this when a site needs different access levels for different logged-in users (admin vs member, staff vs customer, team roles on a dashboard/SaaS). This requires the Authentication capability first — roles apply to real \`project_site_users\` accounts, never fake local state.

### BACKEND CONTRACTS
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

Assign a role/permissions to a user:
{ projectId: "{{PROJECT_ID}}", action: "roles/assign", data: { siteUserId: string, role?: string, permissions?: string[] } }
→ { user: { id, email, display_name, role, permissions } }

Check a user's role/permission:
{ projectId: "{{PROJECT_ID}}", action: "roles/check", data: { siteUserId: string, permission?: string } }
→ { role: string, permissions: string[], hasPermission: boolean }

List users (optionally filter by role):
{ projectId: "{{PROJECT_ID}}", action: "roles/list", data: { role?: string } }
→ { users: [{ id, email, display_name, role, permissions, created_at, last_login }, ...] }
\`\`\`

### REQUIRED BEHAVIOR
- After login (see Authentication capability), the returned \`user.role\` / \`user.permissions\` tell you what to show — gate admin-only UI (e.g. a "Team" or "Admin" nav link) behind \`role === 'owner' || role === 'admin'\`.
- Use \`roles/check\` when you need a fresh, authoritative permission check rather than trusting the cached login response.
- Use \`roles/list\` to render a team-members / user-management table for admins, and \`roles/assign\` to change a member's role from that table.
- Never invent roles or permissions client-side — always read them from the backend response.

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- ❌ NEVER \`import { createClient } from '@supabase/supabase-js'\`
- ❌ NEVER include \`supabaseUrl\` / \`supabaseAnonKey\` in the generated app
- ✅ ALWAYS go through the project-backend-api endpoint
`;
