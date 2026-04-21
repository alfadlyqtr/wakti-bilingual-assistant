// Capability doc: CONTACT / QUOTE / NEWSLETTER / WAITLIST FORMS
//
// Phase A — Item A6 (token diet): the 20-line handleSubmit snippet was
// replaced with a schema + requirements list; the model writes the React
// boilerplate from its own training.

export const FORMS_CAPABILITY = `
## 📝 BACKEND FORMS (CONTACT / QUOTE / NEWSLETTER / WAITLIST / FEEDBACK)

For any submittable form, build the UI with React state + client-side validation, then POST to the backend.

### BACKEND CONTRACT
\`\`\`
POST https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api
Body: {
  projectId: "{{PROJECT_ID}}",
  action: "submit",
  formName: "contact" | "quote" | "newsletter" | "waitlist" | "feedback",
  data: { /* whatever fields the form collects */ }
}
Response: 200 OK on success, non-200 on failure.
\`\`\`

### SUBMIT HANDLER REQUIREMENTS
- \`async (e) => { e.preventDefault(); ... }\`
- Disable the submit button + show a spinner while the request is in-flight.
- On 200: show success feedback (message or animation) and clear the form fields.
- On non-200 / thrown: show user-friendly error feedback (toast / inline), do NOT clear fields.
- Wrap in try/catch/finally; always re-enable the button in \`finally\`.

### CLIENT-SIDE VALIDATION (BEFORE SUBMIT)
- Required fields must be non-empty.
- Email fields must match a basic email regex.
- Phone fields should strip non-digits before submit where relevant.
- Show inline error messages near the offending field.

### formName MAPPING
- "contact"    — general contact forms
- "quote"      — request-a-quote forms
- "newsletter" — email signup
- "waitlist"   — early-access lists
- "feedback"   — product/service feedback
`;
