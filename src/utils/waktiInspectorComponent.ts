// WaktiInspector - A React component that runs INSIDE the Sandpack preview
// This is injected into the index.js entry point so it executes in the iframe
// VERSION 3 - Mobile-first: tap-to-select, touch events, bottom-sheet ready

export const WAKTI_INSPECTOR_COMPONENT = `
// ========== WAKTI INSPECTOR v2026-02-13 ==========
// Runs inside the Sandpack iframe to enable Visual Edits
// MOBILE-FIRST: Touch events + mouse events, tap-to-select
var WAKTI_INSPECTOR_VERSION = 'v2026-02-13-mobile';
console.log('[WaktiInspector] Version:', WAKTI_INSPECTOR_VERSION);

function WaktiInspector() {
  var isInspectMode = React.useState(false);
  var _inspectMode = isInspectMode[0];
  var _setInspectMode = isInspectMode[1];
  var overlayRef = React.useRef(null);
  var currentTargetRef = React.useRef(null);

  // Create overlay on mount and send READY signal immediately
  React.useEffect(function() {
    console.log('[WaktiInspector] Initializing version', WAKTI_INSPECTOR_VERSION);
    
    // Create overlay element — OUTLINE ONLY, no background, no shadow
    var overlay = document.createElement('div');
    overlay.id = 'wakti-inspector-overlay';
    overlay.style.cssText = 'position:fixed;border:2px solid #6366f1;background:transparent;z-index:999999;pointer-events:none;display:none;transition:all 0.08s ease-out;border-radius:4px;box-shadow:none;';
    
    // Add label
    var label = document.createElement('div');
    label.id = 'wakti-inspector-label';
    label.style.cssText = 'position:absolute;top:-24px;left:-2px;background:#6366f1;color:white;padding:3px 10px;font-size:11px;border-radius:4px 4px 0 0;font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap;letter-spacing:0.5px;';
    overlay.appendChild(label);
    document.body.appendChild(overlay);
    overlayRef.current = { overlay: overlay, label: label };

    // Send READY signal
    var sendReady = function() {
      window.parent.postMessage({ type: 'WAKTI_INSPECTOR_READY', version: WAKTI_INSPECTOR_VERSION }, '*');
    };
    sendReady();
    setTimeout(sendReady, 100);
    setTimeout(sendReady, 500);
    setTimeout(sendReady, 1000);

    return function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }, []);

  // Listen for messages from parent
  React.useEffect(function() {
    var handleMessage = function(event) {
      var data;
      try { data = event.data ? JSON.parse(JSON.stringify(event.data)) : {}; } catch(e) { data = {}; }
      var type = data.type;
      var enabled = data.enabled;
      
      if (type === 'WAKTI_TOGGLE_INSPECT') {
        console.log('[WaktiInspector] Toggle inspect mode:', enabled, 'version:', WAKTI_INSPECTOR_VERSION);
        _setInspectMode(enabled);
        
        // ALWAYS enforce: no shadow, no background on the overlay
        if (overlayRef.current) {
          overlayRef.current.overlay.style.boxShadow = 'none';
          overlayRef.current.overlay.style.background = 'transparent';
        }
        
        if (enabled) {
          document.body.style.cursor = 'crosshair';
        } else {
          document.body.style.cursor = '';
          if (overlayRef.current) overlayRef.current.overlay.style.display = 'none';
        }
        
        window.parent.postMessage({ type: 'WAKTI_INSPECT_MODE_CHANGED', payload: { enabled: enabled, version: WAKTI_INSPECTOR_VERSION } }, '*');
      }
      
      if (type === 'WAKTI_INSPECTOR_PING') {
        window.parent.postMessage({ type: 'WAKTI_INSPECTOR_PONG', version: WAKTI_INSPECTOR_VERSION }, '*');
      }
      
      if (type === 'WAKTI_SELECT_PARENT') {
        if (currentTargetRef.current && currentTargetRef.current.parentElement) {
          var parent = currentTargetRef.current.parentElement;
          if (parent !== document.body && parent !== document.documentElement && parent.id !== 'root') {
            var rect = parent.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && overlayRef.current) {
              currentTargetRef.current = parent;
              var ov = overlayRef.current.overlay;
              var lb = overlayRef.current.label;
              ov.style.display = 'block';
              ov.style.top = rect.top + 'px';
              ov.style.left = rect.left + 'px';
              ov.style.width = rect.width + 'px';
              ov.style.height = rect.height + 'px';
              ov.style.background = 'transparent';
              ov.style.boxShadow = 'none';
              
              var labelText = parent.tagName.toLowerCase();
              if (parent.className && typeof parent.className === 'string') {
                var cls = parent.className.split(' ').filter(function(c) { return c && c.indexOf('wakti') === -1; });
                if (cls[0]) labelText += '.' + cls[0];
              }
              if (parent.id) labelText = '#' + parent.id;
              lb.textContent = labelText;
              
              var cs = window.getComputedStyle(parent);
              window.parent.postMessage({ type: 'WAKTI_ELEMENT_SELECTED', payload: {
                tagName: parent.tagName.toLowerCase(),
                className: parent.className || '',
                id: parent.id || '',
                innerText: (parent.innerText || '').trim().substring(0, 150),
                openingTag: parent.outerHTML.split('>')[0] + '>',
                computedStyle: { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize },
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
              }}, '*');
            }
          }
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return function() { window.removeEventListener('message', handleMessage); };
  }, []);

  // Handle mouse + touch events when in inspect mode (MOBILE-FIRST)
  React.useEffect(function() {
    if (!_inspectMode || !overlayRef.current) return;
    
    var overlay = overlayRef.current.overlay;
    var label = overlayRef.current.label;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    var touchStartTarget = null;
    var touchStartTime = 0;
    
    var isSkippable = function(target) {
      if (!target || target === overlay || target.id === 'wakti-inspector-overlay' || target.id === 'wakti-inspector-label') return true;
      if (target === document.body || target === document.documentElement || target.id === 'root') return true;
      var rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return true;
      if (rect.width > vw * 0.85 && rect.height > vh * 0.85) return true;
      return false;
    };
    
    var updateOverlay = function(target) {
      if (isSkippable(target)) {
        overlay.style.display = 'none';
        return;
      }
      
      currentTargetRef.current = target;
      var rect = target.getBoundingClientRect();
      
      overlay.style.display = 'block';
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.background = 'transparent';
      overlay.style.boxShadow = 'none';
      
      var labelText = target.tagName.toLowerCase();
      if (target.className && typeof target.className === 'string') {
        var cls = target.className.split(' ').filter(function(c) { return c && c.indexOf('wakti') === -1; });
        if (cls[0]) labelText += '.' + cls[0];
      }
      if (target.id) labelText = '#' + target.id;
      label.textContent = labelText;
    };

    var selectElement = function(target) {
      if (isSkippable(target)) return;
      
      var rect = target.getBoundingClientRect();
      var cs = window.getComputedStyle(target);
      
      // Build breadcrumb path (for bottom sheet navigation)
      var breadcrumb = [];
      var el = target;
      var maxDepth = 5;
      while (el && el !== document.body && el !== document.documentElement && maxDepth > 0) {
        var tag = el.tagName.toLowerCase();
        var cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(function(c) { return c && c.indexOf('wakti') === -1; })[0] : '';
        breadcrumb.unshift(cls ? tag + '.' + cls : tag);
        el = el.parentElement;
        maxDepth--;
      }
      
      var elementInfo = {
        tagName: target.tagName.toLowerCase(),
        className: target.className || '',
        id: target.id || '',
        innerText: (target.innerText || '').trim().substring(0, 150),
        openingTag: target.outerHTML.split('>')[0] + '>',
        computedStyle: { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize },
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        breadcrumb: breadcrumb
      };

      console.log('[WaktiInspector] Element selected:', elementInfo.tagName, elementInfo.innerText.substring(0, 30));
      window.parent.postMessage({ type: 'WAKTI_ELEMENT_SELECTED', payload: elementInfo }, '*');
      
      // Flash feedback
      overlay.style.background = 'rgba(99, 102, 241, 0.12)';
      setTimeout(function() { overlay.style.background = 'transparent'; }, 150);
    };

    // === MOUSE EVENTS (desktop fallback) ===
    var handleMouseMove = function(e) { updateOverlay(e.target); };
    var handleMouseOut = function(e) {
      if (!e.relatedTarget || e.relatedTarget === document.body) overlay.style.display = 'none';
    };
    var handleClick = function(e) {
      if (isTouchDevice) return; // Skip on touch devices — handled by touch events
      var target = e.target;
      if (isSkippable(target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      updateOverlay(target);
      selectElement(target);
    };
    var handleMouseDown = function(e) {
      if (isTouchDevice) return;
      e.preventDefault();
    };

    // === TOUCH EVENTS (mobile-first) ===
    var handleTouchStart = function(e) {
      if (!e.touches || !e.touches[0]) return;
      var touch = e.touches[0];
      touchStartTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      touchStartTime = Date.now();
      
      // Show highlight immediately on touch
      if (touchStartTarget && !isSkippable(touchStartTarget)) {
        updateOverlay(touchStartTarget);
      }
    };
    
    var handleTouchEnd = function(e) {
      // Only select if it was a quick tap (< 500ms), not a scroll
      var elapsed = Date.now() - touchStartTime;
      if (elapsed > 500 || !touchStartTarget) {
        touchStartTarget = null;
        return;
      }
      
      var target = touchStartTarget;
      touchStartTarget = null;
      
      if (isSkippable(target)) return;
      
      // Prevent the tap from triggering links/buttons in the preview
      e.preventDefault();
      e.stopPropagation();
      
      updateOverlay(target);
      selectElement(target);
    };
    
    var handleTouchMove = function(e) {
      // If user is scrolling, cancel the tap selection
      touchStartTarget = null;
      overlay.style.display = 'none';
    };

    // Register all events
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true });
    
    if (!isTouchDevice) {
      document.body.style.cursor = 'crosshair';
    }

    return function() {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('touchmove', handleTouchMove, true);
      document.body.style.cursor = '';
      overlay.style.display = 'none';
    };
  }, [_inspectMode]);

  return null;
}
`;
