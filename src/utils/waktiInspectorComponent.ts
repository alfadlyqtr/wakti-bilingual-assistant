// WaktiInspector - A React component that runs INSIDE the Sandpack preview
// This is injected into the index.js entry point so it executes in the iframe
// ROBUST VERSION - with immediate ready signal and simplified event handling

export const WAKTI_INSPECTOR_COMPONENT = `
// ========== WAKTI INSPECTOR COMPONENT ==========
// Runs inside the Sandpack iframe to enable Visual Edits
function WaktiInspector() {
  const [isInspectMode, setIsInspectMode] = React.useState(false);
  const overlayRef = React.useRef(null);
  const currentTargetRef = React.useRef(null);

  // Create overlay on mount and send READY signal immediately
  React.useEffect(() => {
    console.log('[WaktiInspector] Initializing...');
    
    // Create overlay element for highlighting
    const overlay = document.createElement('div');
    overlay.id = 'wakti-inspector-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      border: '2px solid #6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      zIndex: '999999',
      pointerEvents: 'none',
      display: 'none',
      transition: 'all 0.08s ease-out',
      borderRadius: '4px',
      boxShadow: '0 0 0 2000px rgba(0, 0, 0, 0.1)'
    });
    
    // Add label
    const label = document.createElement('div');
    Object.assign(label.style, {
      position: 'absolute',
      top: '-24px',
      left: '-2px',
      backgroundColor: '#6366f1',
      color: 'white',
      padding: '3px 10px',
      fontSize: '11px',
      borderRadius: '4px 4px 0 0',
      fontFamily: 'ui-monospace, monospace',
      fontWeight: '600',
      whiteSpace: 'nowrap',
      letterSpacing: '0.5px'
    });
    label.id = 'wakti-inspector-label';
    overlay.appendChild(label);
    document.body.appendChild(overlay);
    overlayRef.current = { overlay, label };

    // Send READY signal immediately and repeatedly to ensure parent receives it
    const sendReady = () => {
      window.parent.postMessage({ type: 'WAKTI_INSPECTOR_READY' }, '*');
      console.log('[WaktiInspector] READY signal sent');
    };
    
    // Send immediately
    sendReady();
    // Send again after a short delay (in case parent isn't ready)
    setTimeout(sendReady, 100);
    setTimeout(sendReady, 500);
    setTimeout(sendReady, 1000);

    return () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }, []);

  // Listen for messages from parent
  React.useEffect(() => {
    const handleMessage = (event) => {
      const { type, enabled } = event.data || {};
      
      if (type === 'WAKTI_TOGGLE_INSPECT') {
        console.log('[WaktiInspector] Toggle inspect mode:', enabled);
        setIsInspectMode(enabled);
        
        // Acknowledge the mode change
        window.parent.postMessage({ 
          type: 'WAKTI_INSPECT_MODE_CHANGED', 
          payload: { enabled } 
        }, '*');
        
        // Hide overlay when mode is disabled
        if (!enabled && overlayRef.current) {
          overlayRef.current.overlay.style.display = 'none';
        }
      }
      
      if (type === 'WAKTI_INSPECTOR_PING') {
        window.parent.postMessage({ type: 'WAKTI_INSPECTOR_PONG' }, '*');
      }
      
      // NEW: Handle parent selection request
      if (type === 'WAKTI_SELECT_PARENT') {
        if (currentTargetRef.current?.parentElement) {
          const parent = currentTargetRef.current.parentElement;
          if (parent !== document.body && parent !== document.documentElement && parent.id !== 'root') {
            // Update overlay to show parent
            const rect = parent.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && overlayRef.current) {
              currentTargetRef.current = parent;
              const { overlay, label } = overlayRef.current;
              Object.assign(overlay.style, {
                display: 'block',
                top: rect.top + 'px',
                left: rect.left + 'px',
                width: rect.width + 'px',
                height: rect.height + 'px'
              });
              
              // Update label
              let labelText = parent.tagName.toLowerCase();
              if (parent.className && typeof parent.className === 'string') {
                const cleanClasses = parent.className.split(' ').filter(c => c && !c.includes('wakti'));
                if (cleanClasses[0]) labelText += '.' + cleanClasses[0];
              }
              if (parent.id) labelText = '#' + parent.id;
              label.textContent = labelText;
              
              // Gather and send parent info
              const computedStyle = window.getComputedStyle(parent);
              const elementInfo = {
                tagName: parent.tagName.toLowerCase(),
                className: parent.className || '',
                id: parent.id || '',
                innerText: (parent.innerText || '').trim().substring(0, 150),
                openingTag: parent.outerHTML.split('>')[0] + '>',
                computedStyle: {
                  color: computedStyle.color,
                  backgroundColor: computedStyle.backgroundColor,
                  fontSize: computedStyle.fontSize
                },
                rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
              };
              window.parent.postMessage({ 
                type: 'WAKTI_ELEMENT_SELECTED', 
                payload: elementInfo 
              }, '*');
            }
          }
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle mouse events when in inspect mode
  React.useEffect(() => {
    if (!isInspectMode || !overlayRef.current) return;
    
    const { overlay, label } = overlayRef.current;
    
    const updateOverlay = (target) => {
      if (!target || target === overlay || target.id === 'wakti-inspector-overlay' || target.id === 'wakti-inspector-label') {
        overlay.style.display = 'none';
        return;
      }
      
      // Skip html, body, and root elements
      if (target === document.body || target === document.documentElement || target.id === 'root') {
        overlay.style.display = 'none';
        return;
      }
      
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        overlay.style.display = 'none';
        return;
      }
      
      currentTargetRef.current = target;
      
      Object.assign(overlay.style, {
        display: 'block',
        top: rect.top + 'px',
        left: rect.left + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px'
      });
      
      // Build label text
      let labelText = target.tagName.toLowerCase();
      if (target.className && typeof target.className === 'string') {
        const cleanClasses = target.className.split(' ').filter(c => c && !c.includes('wakti'));
        if (cleanClasses[0]) labelText += '.' + cleanClasses[0];
      }
      if (target.id) labelText = '#' + target.id;
      label.textContent = labelText;
    };

    const handleMouseMove = (e) => {
      updateOverlay(e.target);
    };

    const handleMouseOut = (e) => {
      if (!e.relatedTarget || e.relatedTarget === document.body) {
        overlay.style.display = 'none';
      }
    };

    const handleClick = (e) => {
      const target = e.target;
      if (!target || target === overlay || target.id === 'wakti-inspector-overlay') return;
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Gather element info
      const rect = target.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(target);
      
      const elementInfo = {
        tagName: target.tagName.toLowerCase(),
        className: target.className || '',
        id: target.id || '',
        innerText: (target.innerText || '').trim().substring(0, 150),
        openingTag: target.outerHTML.split('>')[0] + '>',
        computedStyle: {
          color: computedStyle.color,
          backgroundColor: computedStyle.backgroundColor,
          fontSize: computedStyle.fontSize
        },
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      };

      console.log('[WaktiInspector] Element selected:', elementInfo.tagName, elementInfo.innerText.substring(0, 30));
      
      // Send to parent
      window.parent.postMessage({ 
        type: 'WAKTI_ELEMENT_SELECTED', 
        payload: elementInfo 
      }, '*');
      
      // Visual feedback - flash the overlay
      overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.4)';
      overlay.style.borderColor = '#818cf8';
      setTimeout(() => {
        overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
        overlay.style.borderColor = '#6366f1';
      }, 150);
    };

    // Use capture phase for reliable event handling
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    
    // Also prevent default on mousedown to avoid text selection while inspecting
    const handleMouseDown = (e) => {
      if (isInspectMode) {
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', handleMouseDown, true);

    // Set cursor style
    document.body.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.body.style.cursor = '';
      overlay.style.display = 'none';
    };
  }, [isInspectMode]);

  return null;
}
`;
