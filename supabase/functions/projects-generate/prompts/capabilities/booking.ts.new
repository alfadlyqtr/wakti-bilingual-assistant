// Capability doc: BOOKING / APPOINTMENT / SCHEDULING
//
// Phase A — Item A6 (token diet): the 70-line combined fetch + handleBooking
// snippet was replaced with the API contracts and UI requirements. The model
// writes React state, form UI, and error handling from its training.

export const BOOKING_CAPABILITY = `
## 📅 BOOKING / APPOINTMENT SYSTEM

🚨 Services are ALREADY seeded in the backend. You MUST fetch them — NEVER hardcode services.

### BACKEND CONTRACTS
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api

Fetch services:
{ projectId: "{{PROJECT_ID}}", action: "collection/services" }
→ { items: [{ id, data: { name, duration, price, description? } }, ...] }

Check availability (optional):
{ projectId: "{{PROJECT_ID}}", action: "booking/check", data: { date: "YYYY-MM-DD", startTime: "HH:MM" } }
→ { available: boolean }

Create booking:
{
  projectId: "{{PROJECT_ID}}",
  action: "booking/create",
  data: {
    serviceName: string,
    date: "YYYY-MM-DD",
    startTime: "HH:MM",
    customerInfo: { name, email, phone },
    notes?: string
  }
}
→ 200 OK on success.
\`\`\`

### REQUIRED BEHAVIOR
- On mount: fetch services with \`collection/services\`, show a loading state, then render from \`items\`. Render service name + duration (min) + price from \`item.data\`.
- NEVER hardcode services like \`const services = [{ name: 'Consultation', ... }]\` — always drive from the backend response.
- After successful \`booking/create\`: reset the form and show a success message/animation.

### UI REQUIREMENTS (multi-step form)
1. **Select service** — cards from the backend; highlight the chosen one.
2. **Pick date / time** — date picker + time-slot grid. Use \`booking/check\` if you want to grey out unavailable slots.
3. **Customer details** — name, email, phone, optional notes.
4. **Summary & confirm** — show everything before submission.
5. **Success** — confirmation with the booking details.

Handle loading, empty services (CTA), and error states explicitly.
`;
