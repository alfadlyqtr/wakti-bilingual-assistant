// Capability doc: BOOKING / APPOINTMENT / SCHEDULING

export const BOOKING_CAPABILITY = `
## 📅 BOOKING / APPOINTMENT SYSTEM

🚨 **Services are ALREADY seeded in the backend. You MUST fetch them — NEVER hardcode services!**

### PATTERN (barber, salon, spa, clinic, consultations, etc.)

\`\`\`jsx
const BACKEND_URL = "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api";

// MANDATORY: Fetch services from backend
const [services, setServices] = useState([]);
const [servicesLoading, setServicesLoading] = useState(true);

useEffect(() => {
  const fetchServices = async () => {
    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: '{{PROJECT_ID}}',
          action: 'collection/services'
        })
      });
      const data = await res.json();
      if (data.ok && data.items) setServices(data.items);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setServicesLoading(false);
    }
  };
  fetchServices();
}, []);

// Booking form state
const [booking, setBooking] = useState({
  name: '', email: '', phone: '',
  service: '', date: '', time: '', notes: ''
});

const handleBooking = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '{{PROJECT_ID}}',
        action: 'booking/create',
        data: {
          serviceName: booking.service,
          date: booking.date,
          startTime: booking.time,
          customerInfo: { name: booking.name, email: booking.email, phone: booking.phone },
          notes: booking.notes
        }
      })
    });
    if (res.ok) {
      setSuccess(true);
      setBooking({ name: '', email: '', phone: '', service: '', date: '', time: '', notes: '' });
    }
  } catch (err) {
    console.error('Booking failed:', err);
  } finally {
    setLoading(false);
  }
};

// JSX — use fetched services, NOT hardcoded
{servicesLoading ? (
  <p>Loading services...</p>
) : (
  <select value={booking.service} onChange={(e) => setBooking({...booking, service: e.target.value})}>
    <option value="">Select a service</option>
    {services.map((s) => (
      <option key={s.id} value={s.data?.name}>{s.data?.name} — {s.data?.duration}min — \${s.data?.price}</option>
    ))}
  </select>
)}
\`\`\`

### ❌ NEVER DO THIS
\`\`\`jsx
// WRONG — hardcoded services
const services = [
  { name: "Consultation", duration: 30, price: 50 },
];
\`\`\`

✅ ALWAYS fetch from backend with \`action: 'collection/services'\`

### BOOKING UI REQUIREMENTS
- Multi-step form: 1) Select Service (from backend) → 2) Pick Date/Time → 3) Enter Details
- Service cards with name, duration, and price FROM THE BACKEND
- Date picker with available dates highlighted
- Time slots grid showing available times
- Summary panel before confirmation
- Success animation after booking confirmed
`;
