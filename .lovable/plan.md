

# Fix: Header Positioning and Sandpack Iframe Layout

## Problem Summary

Two layout issues on the ProjectDetail page:
1. **Header scrolling**: The header in HeroScene uses `absolute` positioning instead of `fixed`, causing it to scroll with the page content
2. **Sandpack cutoff**: The preview container's padding and height constraints are causing the Sandpack iframe to be clipped

---

## Technical Analysis

### Issue 1: Header Positioning (HeroScene)

**Current State:**
The header in `src/components/landing/HeroScene.tsx` (lines 60-89) uses:
```css
className="absolute top-4 right-4 z-20..."
style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
```

**Problem:**
`absolute` positioning places the header relative to its parent `<section>`, so when the landing page scroll-snaps between scenes, the header scrolls away.

**Solution:**
Change to `fixed` positioning so the header stays at the top of the viewport regardless of scroll position.

### Issue 2: Sandpack Iframe Cutoff

**Current State:**
In `src/pages/ProjectDetail.tsx` (line 8421):
```jsx
<div className="flex-1 min-h-0 sandpack-preview-container relative pt-[56px] pb-0 overflow-hidden">
```

**Problem:**
The `pt-[56px]` padding-top reduces available height, but the inner Sandpack container expects `h-full` which doesn't account for this padding.

**Solution:**
Use a CSS calculation to ensure proper height: `h-[calc(100%-56px)]` on the inner container, or adjust the layout to use margin instead of padding.

---

## Files to Modify

### File 1: `src/components/landing/HeroScene.tsx`

**Change:** Update header from `absolute` to `fixed` positioning

**Before (lines 60-65):**
```tsx
<motion.div 
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.5, duration: 0.6 }}
  className="absolute top-4 right-4 z-20 flex items-center gap-2..."
  style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
>
```

**After:**
```tsx
<motion.div 
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.5, duration: 0.6 }}
  className="fixed top-4 right-4 z-50 flex items-center gap-2..."
  style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
>
```

**Key Changes:**
- `absolute` → `fixed` (stays at viewport top)
- `z-20` → `z-50` (ensure it stays above all content)

---

### File 2: `src/pages/ProjectDetail.tsx`

**Change:** Fix the Sandpack container height calculation

**Before (line 8421):**
```tsx
<div className="flex-1 min-h-0 sandpack-preview-container relative pt-[56px] pb-0 overflow-hidden">
```

**After:**
```tsx
<div className="flex-1 min-h-0 sandpack-preview-container relative mt-[56px] overflow-hidden" style={{ height: 'calc(100% - 56px)' }}>
```

**Key Changes:**
- `pt-[56px]` → `mt-[56px]` (use margin instead of padding)
- Add `style={{ height: 'calc(100% - 56px)' }}` to explicitly set height

**Alternative approach (if the above doesn't work):**
Change the inner Sandpack wrapper to use explicit height calculation:

**Line 8428-8431:**
```tsx
<div className="w-full h-full flex items-center justify-center relative">
```
to:
```tsx
<div className="absolute inset-0 flex items-center justify-center">
```

---

## CSS Additions (if needed)

Add to `src/index.css` to ensure proper Sandpack container sizing:

```css
/* Fix Sandpack container height in ProjectDetail */
.sandpack-preview-container > div {
  height: 100% !important;
}

.sandpack-preview-container .sp-wrapper {
  height: 100% !important;
}

.sandpack-preview-container .sp-layout {
  height: 100% !important;
}

.sandpack-preview-container .sp-preview-container {
  height: 100% !important;
}
```

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `HeroScene.tsx` | `absolute` → `fixed` | Keep header at viewport top during scroll |
| `HeroScene.tsx` | `z-20` → `z-50` | Ensure header stays above all scenes |
| `ProjectDetail.tsx` | `pt-[56px]` → `mt-[56px]` + explicit height | Fix iframe cutoff |
| `index.css` (optional) | Add Sandpack height rules | Ensure full height rendering |

---

## Testing Checklist

After implementation:
1. Verify the landing page header stays fixed at top when scrolling between scenes
2. Verify the Sandpack preview fills the full available height
3. Test on both mobile and desktop viewports
4. Ensure the visual edit mode banner still appears correctly
5. Check that the console panel at the bottom doesn't get cut off

