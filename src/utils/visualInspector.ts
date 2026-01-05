// Visual Inspector Script - Injected into Sandpack preview iframe
// This enables "Reverse DOM Inspection" like Lovable's blue box feature

export const INSPECTOR_SCRIPT = `
(function() {
  let isInspectMode = false;
  let selectedElement = null;

  // 1. Create the Highlighting Overlay Box
  const overlay = document.createElement('div');
  overlay.id = 'wakti-inspector-overlay';
  overlay.style.cssText = \`
    position: fixed;
    border: 2px solid #6366f1;
    background-color: rgba(99, 102, 241, 0.1);
    z-index: 999999;
    pointer-events: none;
    display: none;
    transition: all 0.1s ease;
    border-radius: 4px;
  \`;
  
  // Tag Label (e.g., "button.primary")
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

  // 2. Listen for messages from Wakti parent
  window.addEventListener('message', (event) => {
    if (event.data.type === 'WAKTI_TOGGLE_INSPECT') {
      isInspectMode = event.data.enabled;
      if (!isInspectMode) {
        overlay.style.display = 'none';
        selectedElement = null;
      }
    }
  });

  // 3. Hover Effect - Track mouse and highlight elements
  document.addEventListener('mousemove', (e) => {
    if (!isInspectMode) return;
    
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
    
    // Build label text
    let labelText = target.tagName.toLowerCase();
    if (target.className && typeof target.className === 'string') {
      const firstClass = target.className.split(' ').filter(c => c && !c.includes('wakti'))[0];
      if (firstClass) labelText += '.' + firstClass;
    }
    label.innerText = labelText;
  });

  // 4. Touch support for mobile
  document.addEventListener('touchmove', (e) => {
    if (!isInspectMode) return;
    
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
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
  }, { passive: true });

  // 5. Selection Click - Capture the element
  document.addEventListener('click', (e) => {
    if (!isInspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (!target || target === overlay) return;
    
    selectedElement = target;
    
    // Get detailed info about the element
    const elementInfo = {
      tagName: target.tagName.toLowerCase(),
      className: target.className || '',
      id: target.id || '',
      innerText: (target.innerText || '').trim().substring(0, 100),
      // Get just the opening tag for context
      openingTag: target.outerHTML.split('>')[0] + '>',
      // Get computed styles for context
      computedStyle: {
        color: getComputedStyle(target).color,
        backgroundColor: getComputedStyle(target).backgroundColor,
        fontSize: getComputedStyle(target).fontSize,
      }
    };

    // Send to Parent (Wakti)
    window.parent.postMessage({ 
      type: 'WAKTI_ELEMENT_SELECTED', 
      payload: elementInfo 
    }, '*');
    
    // Flash effect to confirm selection
    overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
    setTimeout(() => {
      overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
    }, 200);
    
  }, true);

  // 6. Touch selection for mobile
  document.addEventListener('touchend', (e) => {
    if (!isInspectMode) return;
    
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target || target === overlay) return;
    
    e.preventDefault();
    
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

    window.parent.postMessage({ 
      type: 'WAKTI_ELEMENT_SELECTED', 
      payload: elementInfo 
    }, '*');
    
  }, { passive: false });

  // Hide overlay when mouse leaves
  document.addEventListener('mouseleave', () => {
    if (isInspectMode) {
      overlay.style.display = 'none';
    }
  });

  console.log('[Wakti Inspector] Loaded and ready');
})();
`;
