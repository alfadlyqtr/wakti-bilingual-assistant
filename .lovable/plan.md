

# Fix: Stop wakti.ai from Redirecting to wakti.qa

## The Problem

In `middleware.ts` (line 34-36), there's a **hard redirect** that sends all `wakti.ai` root traffic to `wakti.qa`:

```text
wakti.ai  -->  302/308 redirect to wakti.qa  (WRONG)
www.wakti.ai  -->  302/308 redirect to wakti.qa  (WRONG)
```

This means users never reach the marketing landing pages — they get bounced to the app before your React code even loads.

## The Fix

Simple change to `middleware.ts`:

- **wakti.ai** (root domain): **Pass through** — let the SPA load and render the marketing pages (your `isWaktiDomain()` logic in `App.tsx` already handles this correctly)
- **www.wakti.ai**: **Redirect to wakti.ai** (canonical redirect, not to wakti.qa)
- **\*.wakti.ai** (subdomains): Keep the existing rewrite to `/preview/[subdomain]` for user-generated projects — no change needed here

## Updated Traffic Flow

```text
wakti.ai            --> Pass through --> SPA renders marketing pages
www.wakti.ai        --> 308 redirect --> wakti.ai (canonical)
mozi.wakti.ai       --> Rewrite to /preview/mozi (user projects, unchanged)
anyproject.wakti.ai --> Rewrite to /preview/anyproject (unchanged)
wakti.qa            --> Pass through --> Main app (unchanged)
localhost            --> Pass through (unchanged)
```

## Technical Changes

### File: `middleware.ts`

**Lines 33-36** — Replace the redirect with a pass-through:

```typescript
// Handle root domain (wakti.ai) - serve marketing landing pages
if (hostname === 'wakti.ai' || hostname.startsWith('wakti.ai:')) {
  return; // Pass through — SPA renders marketing pages via isWaktiDomain()
}
```

**Lines 44-45** — Update www redirect to point to wakti.ai instead of wakti.qa:

```typescript
if (subdomain === 'www') {
  return Response.redirect('https://wakti.ai', 308);
}
```

### No other files change

`App.tsx`, `WaktiHeader.tsx`, and `WaktiFooter.tsx` already have the correct `isWaktiDomain()` logic that only matches `wakti.ai` / `www.wakti.ai`.

## Summary

Two lines change in one file. Everything else is already wired correctly. After publishing, the domains will behave as:

| Domain | Behavior |
|--------|----------|
| `wakti.ai` | Marketing landing pages (Home, Features, About, etc.) |
| `www.wakti.ai` | Redirects to `wakti.ai` |
| `*.wakti.ai` | User-generated project previews |
| `wakti.qa` | Main WAKTI app (login, dashboard, etc.) |

