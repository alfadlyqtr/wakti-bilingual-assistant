# WAKTI Backend Documentation

## Overview

WAKTI offers a **simple, no-code backend** for user projects. This backend is powered by Supabase Edge Functions and provides:

1. **Form Submissions** - Receive contact forms, newsletters, feedback
2. **Collections** - Store dynamic data like products, blog posts, testimonials
3. **File Uploads** - Upload images, PDFs, documents (50MB limit per project)
4. **Site Users** - Simple user authentication for published sites

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WAKTI Project Backend                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Uploads    │  │    Inbox     │  │    Data      │       │
│  │  (Storage)   │  │ (Form Subs)  │  │ (Collections)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐                                            │
│  │    Users     │                                            │
│  │ (Site Auth)  │                                            │
│  └──────────────┘                                            │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│            Edge Function: project-backend-api                │
│            Storage Bucket: project-uploads                   │
└─────────────────────────────────────────────────────────────┘
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
- `status` - "active" | "suspended"
- `last_login` - Last login timestamp

## Edge Function API

**Endpoint:** `https://<project-ref>.supabase.co/functions/v1/project-backend-api`

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

## What WAKTI Backend Does NOT Provide

- ❌ Email sending (requires external service like SendGrid)
- ❌ Scheduled jobs/cron (not available in Supabase)
- ❌ Webhooks (requires custom implementation)
- ❌ SMS/Push notifications (requires external service)
- ❌ Advanced authentication (OAuth, SSO, MFA)

## Usage in AI Coder

When building projects in the AI Coder, the backend API can be called from the published site:

```javascript
// Example: Submit contact form
async function submitContactForm(data) {
  const response = await fetch(
    'https://bphomzehvaubsxmafvxf.supabase.co/functions/v1/project-backend-api',
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
    'https://bphomzehvaubsxmafvxf.supabase.co/functions/v1/project-backend-api' +
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
