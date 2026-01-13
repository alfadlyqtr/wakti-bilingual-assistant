// WaktiInspector - A React component that runs INSIDE the Sandpack preview
// This is injected into the index.js entry point so it executes in the iframe

export const WAKTI_INSPECTOR_COMPONENT = `
// ========== WAKTI INSPECTOR COMPONENT ==========
// Runs inside the Sandpack iframe to enable Visual Edits
function WaktiInspector() {
  const [isInspectMode, setIsInspectMode] = React.useState(false);
  const overlayRef = React.useRef(null);
  const labelRef = React.useRef(null);

  React.useEffect(() => {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = 'wakti-inspector-overlay';
    overlay.style.cssText = \`
      position: fixed;
      border: 2px solid #6366f1;
      background-color: rgba(99, 102, 241, 0.1);
      z-index: 999999;
      pointer-events: none;
      display: none;
      transition: all 0.05s ease;
      border-radius: 4px;
    \`;
    
    const label = document.createElement('span');
    label.style.cssText = \`
      position: absolute;
      top: -22px;
      left: -2px;
      background-color: #6366f1;
      color: white;
      padding: 2px 8px;
      font-size: 10px;
      border-radius: 4px 4px 0 0;
      font-family: ui-monospace, monospace;
      font-weight: 600;
      white-space: nowrap;
    \`;
    overlay.appendChild(label);
    document.body.appendChild(overlay);
    
    overlayRef.current = overlay;
    labelRef.current = label;

    // Send READY signal to parent
    window.parent.postMessage({ type: 'WAKTI_INSPECTOR_READY' }, '*');
    console.log('[WaktiInspector] Component mounted, READY sent');

    return () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
  }, []);

  // Listen for toggle messages from parent
  React.useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'WAKTI_TOGGLE_INSPECT') {
        const enabled = event.data.enabled;
        setIsInspectMode(enabled);
        console.log('[WaktiInspector] Inspect mode:', enabled);
        
        // Send acknowledgment
        window.parent.postMessage({ 
          type: 'WAKTI_INSPECT_MODE_CHANGED', 
          payload: { enabled } 
        }, '*');
        
        if (!enabled && overlayRef.current) {
          overlayRef.current.style.display = 'none';
        }
      }
      
      if (event.data.type === 'WAKTI_INSPECTOR_PING') {
        window.parent.postMessage({ type: 'WAKTI_INSPECTOR_PONG' }, '*');
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Mouse tracking for hover highlight
  React.useEffect(() => {
    if (!isInspectMode) return;
    
    const overlay = overlayRef.current;
    const label = labelRef.current;
    if (!overlay || !label) return;

    const handleMouseMove = (e) => {
      const target = e.target;
      if (!target || target === overlay || target === document.body || target === document.documentElement) {
        overlay.style.display = 'none';
        return;
      }

      const rect = target.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      
      let labelText = target.tagName.toLowerCase();
      if (target.className && typeof target.className === 'string') {
        const firstClass = target.className.split(' ').filter(c => c && !c.includes('wakti'))[0];
        if (firstClass) labelText += '.' + firstClass;
      }
      label.innerText = labelText;
    };

    const handleMouseLeave = () => {
      overlay.style.display = 'none';
    };

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target;
      if (!target || target === overlay) return;
      
      const elementInfo = {
        tagName: target.tagName.toLowerCase(),
        className: target.className || '',
        id: target.id || '',
        innerText: (target.innerText || '').trim().substring(0, 100),
        openingTag: target.outerHTML.split('>')[0] + '>',
        computedStyle: {
          color: getComputedStyle(target).color,
          backgroundColor: getComputedStyle(target).backgroundColor,
          fontSize: getComputedStyle(target).fontSize,
        }
      };

      console.log('[WaktiInspector] Element selected:', elementInfo.tagName);
      window.parent.postMessage({ 
        type: 'WAKTI_ELEMENT_SELECTED', 
        payload: elementInfo 
      }, '*');
      
      // Flash effect
      overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
      setTimeout(() => {
        overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
      }, 200);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isInspectMode]);

  return null; // Invisible component
}
`;
