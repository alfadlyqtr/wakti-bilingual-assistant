# WAKTI Backend Documentation

## Overview

WAKTI offers a **simple, no-code backend** for user projects. This backend is powered by a single Supabase Edge Function (`project-backend-api`) and provides:

1. **Form Submissions** - Contact forms, newsletters, feedback (auto-creates a booking if the form looks like a booking form)
2. **Collections** - Dynamic data storage like products, blog posts, testimonials (mini-CMS)
3. **File Uploads** - Images, PDFs, documents (per-project storage limit)
4. **Site Users** - Simple email/password authentication for published sites (SHA-256 hashed passwords, 7-day tokens)
5. **Roles & Permissions** - Assign/check roles for site users (owner/admin/custom + permission list)
6. **Cart & Orders** - Shopping cart persistence and order creation/list/update, with automatic inventory decrement
7. **Inventory** - Stock tracking, low-stock threshold checks, manual adjust/set
8. **Bookings** - Appointment/reservation booking with double-booking conflict checks, synced to the owner's WAKTI calendar (`project_calendar_entries`)
9. **Chat** - Simple chat rooms and messages between site users and the owner
10. **Comments** - Threaded comments on any item (blog post, product, etc.)
11. **Notifications + Real-time Push** - Every booking, order, contact form submission, and comment automatically creates a notification for the project owner AND sends a real-time push notification via OneSignal to their phone

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      WAKTI Project Backend                        │
├───────────────────────────────────────────────────────────────────┤
│  Uploads   Inbox(Forms)   Data(Collections)   Users(Site Auth)    │
│  Cart/Orders   Inventory   Bookings   Chat   Comments   Roles     │
├───────────────────────────────────────────────────────────────────┤
│            Edge Function: project-backend-api                     │
│            Storage Bucket: project-uploads                        │
│            Push: OneSignal (via createOwnerNotification)          │
└───────────────────────────────────────────────────────────────────┘
```

## Database Tables

### 1. `project_backends`
Stores backend configuration per project.
- `project_id` - Links to projects table
- `user_id` - Project owner
- `enabled` - Whether backend is active
- `allowed_origins` - CORS whitelist (empty = allow all)
- `features` - JSON config for feature toggles

### 2. `project_uploads`
File upload records.
- `project_id` - Project reference
- `user_id` - Owner ID
- `filename` - Original filename
- `storage_path` - Path in project-uploads bucket
- `file_type` - MIME type
- `size_bytes` - File size

### 3. `project_form_submissions`
Contact form and newsletter submissions.
- `project_id` - Project reference
- `user_id` - Owner ID
- `form_name` - Form identifier (e.g., "contact", "newsletter")
- `data` - JSON submission data
- `status` - "unread" | "read"
- `origin` - Request origin URL

### 4. `project_collections`
Dynamic data storage (like a mini-CMS).
- `project_id` - Project reference
- `user_id` - Owner ID
- `collection_name` - Collection identifier
- `data` - JSON data object
- `status` - "active" | "deleted"
- `sort_order` - For custom ordering

### 5. `project_collection_schemas`
Auto-generated schemas for collections.
- `project_id` - Project reference
- `collection_name` - Collection identifier
- `schema` - JSON field definitions
- `display_name` - Human-readable name

### 6. `project_site_users`
Site visitor accounts (NOT WAKTI users).
- `project_id` - Project reference
- `owner_id` - Project owner
- `email` - User email (unique per project)
- `password_hash` - SHA-256 hashed password
- `display_name` - Optional display name
- `role` - "owner" | "admin" | custom role string
- `permissions` - JSON array of permission strings
- `status` - "active" | "suspended"
- `last_login` - Last login timestamp

### 7. `project_carts` / `project_orders`
Shopping cart and order records.
- `project_orders`: `items`, `buyer_info`, `total_amount`, `status` (pending/etc.), `notes`, `site_user_id`, `session_id`

### 8. `project_bookings`
Appointment/reservation records, synced to the owner's WAKTI calendar.
- `service_name`, `booking_date`, `start_time`, `end_time`, `duration`, `customer_info`, `status`, `calendar_entry_id`

### 9. `project_calendar_entries`
Calendar entries auto-created for bookings so they show up on the owner's WAKTI calendar.

### 10. `project_chat_rooms` / `project_chat_messages`
Simple chat between site users and the project owner.

### 11. `project_comments`
Threaded comments on any item.
- `item_type`, `item_id`, `content`, `site_user_id`, `author_name`, `parent_id`

### 12. `project_notifications`
Owner-facing notifications, each mirrored to a real-time push via OneSignal.
- `type` (booking/order/contact/comment/low_stock), `title`, `message`, `data`, `read`, `push_sent`, `onesignal_notification_id`

## Edge Function API

**Endpoint:** `https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api`

All namespaced actions follow the pattern `"<namespace>/<action>"`, e.g. `"booking/create"`, `"cart/add"`, `"order/list"`.

| Namespace | Actions |
|---|---|
| `collection/<name>` | GET / POST / PUT / DELETE (generic CRUD, auto-creates schema) |
| `auth/` | `signup`, `login`, `me` |
| `cart/` | `get`, `add`, `remove`, `update`, `clear` |
| `order/` | `create`, `list`, `get`, `update` |
| `inventory/` | `check`, `set`, `adjust` |
| `booking/` | `check`, `create`, `list`, `update` |
| `chat/` | `rooms`, `createRoom`, `messages`, `send` |
| `comments/` | `list`, `add`, `delete` |
| `roles/` | `assign`, `check`, `list` |
| `notifications/` | `list`, `markRead` |
| (top-level) | `submit` (contact form), `subscribe` (newsletter) |

### Form Submission
```javascript
POST /project-backend-api
{
  "projectId": "uuid",
  "action": "submit",
  "formName": "contact",
  "data": {
    "name": "John",
    "email": "john@example.com",
    "message": "Hello!"
  }
}
```

### Collection CRUD
```javascript
// GET all items
GET /project-backend-api?projectId=uuid&action=collection/products

// CREATE item
POST /project-backend-api
{
  "projectId": "uuid",
  "action": "collection/products",
  "data": { "name": "Widget", "price": 99 }
}

// UPDATE item
PUT /project-backend-api
{
  "projectId": "uuid",
  "action": "collection/products",
  "id": "item-uuid",
  "data": { "name": "Updated Widget", "price": 149 }
}

// DELETE item
DELETE /project-backend-api
{
  "projectId": "uuid",
  "action": "collection/products",
  "id": "item-uuid"
}
```

### Site User Auth
```javascript
// Signup
POST /project-backend-api
{
  "projectId": "uuid",
  "action": "auth/signup",
  "data": {
    "email": "user@example.com",
    "password": "secret123",
    "name": "John Doe"
  }
}

// Login
POST /project-backend-api
{
  "projectId": "uuid",
  "action": "auth/login",
  "data": {
    "email": "user@example.com",
    "password": "secret123"
  }
}

// Get current user
POST /project-backend-api
{
  "projectId": "uuid",
  "action": "auth/me",
  "data": {
    "token": "base64-token-here"
  }
}
```

### File Upload
```javascript
// Multipart form data
const formData = new FormData();
formData.append('projectId', 'uuid');
formData.append('file', fileBlob);

fetch('/project-backend-api', {
  method: 'POST',
  body: formData
});
```

## Storage

**Bucket:** `project-uploads`
- Public bucket for project assets
- Path format: `{projectId}/{timestamp}-{filename}`
- Max file size: 10MB per file
- Max storage: 50MB per project

## RLS Policies

All backend tables use Row Level Security with project ownership checks:
- Users can only access data for projects they own
- The `project_id` must match a project where `projects.user_id = auth.uid()`

## Dashboard Tabs

1. **Uploads** - Drag & drop file manager with image preview
2. **Inbox** - Form submissions with read/unread status
3. **Data** - Collection manager with add/edit/delete modals
4. **Users** - Site user management with suspend/activate
5. **Orders** - Order list with status updates
6. **Bookings** - Booking list synced with the owner's WAKTI calendar
7. **Chat / Comments** - View and reply to site visitor messages and comments

## Real-time Owner Notifications (Push)

The following events automatically create a notification row AND send a real-time push notification to the project owner's phone via OneSignal (`createOwnerNotification` in `project-backend-api/index.ts`):

- New booking
- New order
- New contact form submission (non-booking forms)
- New comment
- Low stock alert

## What WAKTI Backend Does NOT Provide

- ❌ Email sending (requires external service like SendGrid)
- ❌ Scheduled jobs/cron (not available in Supabase)
- ❌ Webhooks to external URLs (requires custom implementation)
- ❌ Real payment processing (no Stripe/payment gateway integration - orders are recorded but not charged)
- ❌ Advanced authentication (OAuth, SSO, MFA) - site users only support email/password

## Usage in AI Coder

When building projects in the AI Coder, the backend API can be called from the published site:

```javascript
// Example: Submit contact form
async function submitContactForm(data) {
  const response = await fetch(
    'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'YOUR_PROJECT_ID',
        action: 'submit',
        formName: 'contact',
        data
      })
    }
  );
  return response.json();
}

// Example: Fetch products
async function getProducts() {
  const response = await fetch(
    'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/project-backend-api' +
    '?projectId=YOUR_PROJECT_ID&action=collection/products'
  );
  return response.json();
}
```

## Security Considerations

1. **Origin Validation** - Configure `allowed_origins` in production
2. **Password Hashing** - Site user passwords are SHA-256 hashed with salt
3. **Token Expiry** - Site user tokens expire after 7 days
4. **RLS** - All database access is protected by Row Level Security
5. **No Direct DB Access** - All operations go through the edge function
