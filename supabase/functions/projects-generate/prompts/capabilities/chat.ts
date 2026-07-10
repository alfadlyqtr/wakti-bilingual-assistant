export const CHAT_CAPABILITY = `
## 💬 LIVE CHAT / MESSAGING

Use this for a chat widget, direct messages between site users, or a support inbox. NEVER fake this with local-only state — messages must persist on the real backend or they vanish on refresh and the owner never sees them.

### BACKEND CONTRACTS
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

List rooms (optionally for one user):
{ projectId: "{{PROJECT_ID}}", action: "chat/rooms", data: { siteUserId?: string } }
→ { rooms: [{ id, name, type, participants, updated_at }, ...] }

Create a room:
{ projectId: "{{PROJECT_ID}}", action: "chat/createRoom", data: { name?: string, type?: "direct" | "group", participants: string[] } }
→ { room: {...} }

Fetch messages in a room (returned oldest → newest):
{ projectId: "{{PROJECT_ID}}", action: "chat/messages", data: { roomId: string, limit?: number, before?: string } }
→ { messages: [{ id, room_id, sender_id, content, message_type, created_at }, ...] }

Send a message:
{ projectId: "{{PROJECT_ID}}", action: "chat/send", data: { roomId: string, senderId?: string, content: string, messageType?: string } }
→ { message: {...} }
\`\`\`

### REQUIRED BEHAVIOR
- On opening a room, fetch \`chat/messages\` and render in the order returned (oldest → newest).
- After sending, append the new message optimistically; roll it back or mark it failed if the request errors.
- There is no websocket/push transport — poll \`chat/messages\` on an interval (e.g. every 4-6s) while a room is open so new messages appear without a manual refresh.
- Show loading, empty ("No messages yet — say hello"), and error states.
- Never hardcode sample conversations — always start from a real fetched (possibly empty) room.

### NO SUPABASE CLIENT IN GENERATED PROJECTS
- ❌ NEVER \`import { createClient } from '@supabase/supabase-js'\`
- ❌ NEVER include \`supabaseUrl\` / \`supabaseAnonKey\` in the generated app
- ✅ ALWAYS go through the project-backend-api endpoint
`;
