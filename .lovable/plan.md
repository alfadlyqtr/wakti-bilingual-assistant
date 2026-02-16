
## Fix Partner Logos to Load from Supabase Storage

### Problem
The logos are uploaded to the Supabase `partners` bucket but the component still uses local file imports. Additionally, the CSS filter `brightness-0 invert` is making logos invisible.

### Changes

**File: `src/components/wakti-landing/WaktiPartners.tsx`**

1. Remove the 3 local asset imports (lines 3-5)
2. Update the `partners` array to use Supabase Storage public URLs:
   - `https://hxauxozopvpzpdygoqwf.supabase.co/storage/v1/object/public/partners/MCIT-LOGO-1.jpg`
   - `https://hxauxozopvpzpdygoqwf.supabase.co/storage/v1/object/public/partners/QSTP_Logo_colored-e1720330919282-1-1024x410.png`
   - `https://hxauxozopvpzpdygoqwf.supabase.co/storage/v1/object/public/partners/summit.webp`
3. Remove `brightness-0 invert opacity-70` from the img className and replace with `opacity-90` so logos show their original colors

### Technical Detail
- Lines 1-11: Remove imports, switch to Supabase URL strings
- Line 40: Change className from `brightness-0 invert opacity-70` to `opacity-90`
- No other files affected
