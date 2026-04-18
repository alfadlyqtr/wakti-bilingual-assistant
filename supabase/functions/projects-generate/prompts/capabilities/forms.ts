// Capability doc: CONTACT / QUOTE / NEWSLETTER / WAITLIST FORMS

export const FORMS_CAPABILITY = `
## 📝 BACKEND FORMS (CONTACT / QUOTE / NEWSLETTER / WAITLIST)

When the user asks for any submittable form (contact, quote, newsletter, feedback, waitlist):

1. Build the form UI normally with React state + validation
2. On submit, POST to the WAKTI Backend API:

\`\`\`jsx
const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "{{PROJECT_ID}}",
        action: "submit",
        formName: "contact", // or "quote", "newsletter", "waitlist", "feedback"
        data: { name, email, message }
      })
    });
    if (response.ok) {
      setSuccess(true);
      setName(''); setEmail(''); setMessage('');
    } else {
      throw new Error('Failed to submit');
    }
  } catch (err) {
    setError("Failed to send message. Please try again.");
  } finally {
    setLoading(false);
  }
};
\`\`\`

### FORM REQUIREMENTS
- Loading state (disabled button, spinner) while submitting
- Success message / animation after submission
- Error handling with user-friendly feedback
- Client-side validation (required fields, email format) before submit
- Clear fields after successful submission
- formName describes purpose: "contact", "quote", "newsletter", "feedback", "waitlist"
`;
