

## Fix: Landing Page Not Scrollable on Mobile

### Root Cause

In `src/components/wakti-landing/RippleGrid.css` (line 6), the grid container has `pointer-events: auto`. This WebGL canvas covers the entire hero section and intercepts all touch gestures on mobile, preventing the browser from performing its native vertical scroll.

### Fix (1 file, 2 lines)

**File: `src/components/wakti-landing/RippleGrid.css`**

Add `touch-action: pan-y` to the container so the browser allows vertical touch scrolling through the canvas, while still permitting mouse hover interaction on desktop:

```css
.ripple-grid-container {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  pointer-events: auto;
  touch-action: pan-y;  /* NEW - allow vertical scroll on touch devices */
}
```

This single property tells mobile browsers: "Allow the user to scroll vertically even though this element captures pointer events." Desktop mouse interaction (the ripple-follow effect) continues to work unchanged.

### Why This Works

- `touch-action: pan-y` permits native vertical scrolling gestures to pass through
- `pointer-events: auto` is preserved so desktop mouse hover effects still function
- No other files need changes -- the scroll was only blocked by this canvas overlay

