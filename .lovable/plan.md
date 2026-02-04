

# Fix: Draw Mode Control Buttons Position

## Problem

The control buttons at the bottom of the Draw canvas (Undo, Redo, Clear, Save, Import, etc.) are being cut off and can't be seen on mobile devices.

---

## Solution

Add extra bottom padding to the controls container to push the buttons up and make them fully visible above any mobile navigation or system UI.

---

## Technical Changes

### File: `src/components/wakti-ai/DrawAfterBGCanvas.tsx`

**Line 647** - Update the main container padding:

```typescript
// BEFORE
<div className="flex flex-col gap-4 w-full h-full p-4">

// AFTER
<div className="flex flex-col gap-4 w-full h-full p-4 pb-20">
```

The change adds `pb-20` (5rem / 80px of bottom padding) to ensure the control buttons are pushed up and remain visible above any mobile navigation bars or system UI elements.

---

## Summary

| Change | Before | After |
|--------|--------|-------|
| Main container padding | `p-4` | `p-4 pb-20` |
| Bottom padding | 1rem (16px) | 5rem (80px) |

This single line change will make all the Draw mode control buttons visible.

