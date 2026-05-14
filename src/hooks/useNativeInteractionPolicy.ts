import { useEffect } from "react";

const ALLOW_NATIVE_GESTURE_SELECTOR = '[data-native-gesture="allow"]';

function targetAllowsNativeGestures(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(ALLOW_NATIVE_GESTURE_SELECTOR);
}

export function useNativeInteractionPolicy(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const root = document.documentElement;
    const body = document.body;
    const docTarget: EventTarget = document;

    root.classList.add("native-app-shell");
    body.classList.add("native-app-shell");

    const handleGestureEvent = (event: Event) => {
      if (targetAllowsNativeGestures(event.target)) return;
      event.preventDefault();
    };

    const handleTouchEvent = (event: TouchEvent) => {
      if (targetAllowsNativeGestures(event.target)) return;
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const handleWheelEvent = (event: WheelEvent) => {
      if (targetAllowsNativeGestures(event.target)) return;
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    docTarget.addEventListener("gesturestart", handleGestureEvent, { passive: false, capture: true });
    docTarget.addEventListener("gesturechange", handleGestureEvent, { passive: false, capture: true });
    docTarget.addEventListener("gestureend", handleGestureEvent, { passive: false, capture: true });
    docTarget.addEventListener("touchstart", handleTouchEvent, { passive: false, capture: true });
    docTarget.addEventListener("touchmove", handleTouchEvent, { passive: false, capture: true });
    docTarget.addEventListener("wheel", handleWheelEvent, { passive: false });

    return () => {
      root.classList.remove("native-app-shell");
      body.classList.remove("native-app-shell");
      docTarget.removeEventListener("gesturestart", handleGestureEvent, { capture: true });
      docTarget.removeEventListener("gesturechange", handleGestureEvent, { capture: true });
      docTarget.removeEventListener("gestureend", handleGestureEvent, { capture: true });
      docTarget.removeEventListener("touchstart", handleTouchEvent, { capture: true });
      docTarget.removeEventListener("touchmove", handleTouchEvent, { capture: true });
      docTarget.removeEventListener("wheel", handleWheelEvent);
    };
  }, [enabled]);
}
