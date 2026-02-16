

# New wakti.ai Marketing Landing Page

## Overview

A completely separate, standalone marketing landing page ecosystem for **wakti.ai**. Each section lives on its own page/route for maximum SEO value. No sign-up buttons, no app download prompts -- purely a showcase and storytelling experience. Luxe dark aesthetic throughout.

---

## Route Architecture

Each section is its own page with a persistent header and footer:

```text
/wakti              --> Home / Hero (main landing)
/wakti/features     --> Features showcase
/wakti/about        --> About WAKTI
/wakti/pricing      --> Pricing details
/wakti/blog         --> Blog listing (Supabase-powered)
/wakti/blog/:slug   --> Individual blog post
/wakti/contact      --> Contact page
```

All pages share a common **WaktiHeader** (sticky nav) and **WaktiFooter**.

---

## Header Navigation

- **Logo**: WAKTI wordmark (left)
- **Nav Links**: Home, Features, About, Pricing, Blog, Contact
- **Language Toggle**: EN / AR switch (right)
- **Mobile**: Hamburger icon opening a full-screen overlay menu
- Style: Glassmorphic dark (#0c0f14/90 backdrop-blur), champagne gold (#e9ceb0) accents

No sign-up, no login, no app download buttons in the header.

---

## Pages Breakdown

### 1. Home / Hero (`/wakti`)
- Full-viewport hero with WAKTI branding
- Tagline and brief one-liner about WAKTI
- Showcase images/screenshots of the app
- Partners/clients logo strip (horizontal scroll)
- Subtle animated gradient background
- No CTA buttons for sign-up or download

### 2. Features (`/wakti/features`)
- Grid of all 14+ features (reusing existing feature data)
- Each feature: icon, title, description, optional screenshot
- Mobile: single-column scrollable cards with entrance animations
- Bilingual (EN/AR)

### 3. About (`/wakti/about`)
- "About WAKTI" narrative -- vision, mission, who it's for
- Team or company info (TMW)
- Optional timeline or milestones
- Bilingual content

### 4. Pricing (`/wakti/pricing`)
- Clean pricing card (95 QAR/month)
- Feature list included in the plan
- No sign-up button -- informational only

### 5. Blog Listing (`/wakti/blog`)
- Grid of published blog posts fetched from Supabase
- Each card: cover image, title, excerpt, date
- Pagination or infinite scroll
- Search/filter capability
- Bilingual titles and excerpts

### 6. Blog Post (`/wakti/blog/:slug`)
- Full markdown-rendered article
- Cover image header
- Author name, publish date
- Bilingual toggle (if Arabic version exists)
- Uses `react-markdown` + `rehype-raw` + `remark-gfm` (already installed)

### 7. Contact (`/wakti/contact`)
- Contact form (name, email, message)
- Or links to existing `/contact` page functionality
- Social media links, email address

---

## Database: `blog_posts` Table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| title | text | English title |
| title_ar | text | Arabic title |
| slug | text (unique) | URL-friendly slug |
| excerpt | text | Short preview |
| excerpt_ar | text | Arabic preview |
| content | text | Markdown body |
| content_ar | text | Arabic markdown body |
| cover_image_url | text | Optional image |
| published | boolean | Default false |
| published_at | timestamptz | Publish date |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |
| author_name | text | Author display name |

**RLS Policies:**
- Public SELECT where `published = true`
- Admin-only INSERT/UPDATE/DELETE (tied to existing admin system)

---

## Partners Section (Home Page)

A horizontal scrolling logo strip showing partner/client logos. Images will be uploaded to Supabase Storage or placed in `/public`. Infinite marquee animation for a polished feel.

---

## New Files

| File | Purpose |
|------|---------|
| `src/pages/WaktiLanding.tsx` | Home/Hero page |
| `src/pages/WaktiFeatures.tsx` | Features page |
| `src/pages/WaktiAbout.tsx` | About page |
| `src/pages/WaktiPricingPage.tsx` | Pricing page |
| `src/pages/WaktiBlog.tsx` | Blog listing |
| `src/pages/WaktiBlogPost.tsx` | Blog post view |
| `src/pages/WaktiContactPage.tsx` | Contact page |
| `src/components/wakti-landing/WaktiHeader.tsx` | Shared sticky header |
| `src/components/wakti-landing/WaktiFooter.tsx` | Shared footer |
| `src/components/wakti-landing/WaktiPartners.tsx` | Partners logo marquee |
| `src/components/wakti-landing/WaktiLayout.tsx` | Layout wrapper (header + outlet + footer) |

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/wakti/*` routes with nested layout |

---

## Design Language

- Dark theme: `#0c0f14` base, `#e9ceb0` champagne gold accents
- Framer Motion page transitions and scroll animations
- Minimal, breathable layouts with generous whitespace
- 100% mobile-optimized (single column, touch targets)
- No app download banners on `/wakti/*` routes

## Build Error Fix

The existing `npm:openai@^4.52.5` build error will be resolved by adding the proper import map entry in the edge functions configuration.

