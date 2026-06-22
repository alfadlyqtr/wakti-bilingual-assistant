// Visual Inspector Script - Injected into Sandpack preview iframe
// This enables "Reverse DOM Inspection" like Lovable's blue box feature

export const INSPECTOR_SCRIPT = `
(function() {
  let isInspectMode = false;
  let selectedElement = null;
  let hoveredElement = null;

  // ========== HANDSHAKE: Notify parent that inspector is loaded ==========
  window.parent.postMessage({ type: 'WAKTI_INSPECTOR_READY' }, '*');
  console.log('[Wakti Inspector] Ready signal sent to parent');

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
    transition: all 0.05s ease;
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

  const extractCssUrl = (value) => {
    if (typeof value !== 'string') return '';
    const match = value.match(/url\((['"]?)(.*?)\\1\)/i);
    return match && match[2] ? match[2] : '';
  };

  const buildAssetInfo = (node, mode, url) => ({
    url: url || '',
    mode,
    tagName: node?.tagName ? node.tagName.toLowerCase() : '',
    className: node?.className || '',
    openingTag: node?.outerHTML ? node.outerHTML.split('>')[0] + '>' : '',
  });

  const readAssetFromNode = (node) => {
    if (!node || node === document.body || node === document.documentElement) {
      return null;
    }

    const tagName = node.tagName ? node.tagName.toLowerCase() : '';

    if (tagName === 'img' && node.currentSrc) {
      return buildAssetInfo(node, 'src', node.currentSrc);
    }

    if (tagName === 'img' && node.getAttribute) {
      const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
      if (src) return buildAssetInfo(node, 'src', src);
    }

    if (tagName === 'video' && node.getAttribute) {
      const poster = node.getAttribute('poster') || '';
      if (poster) return buildAssetInfo(node, 'poster', poster);
      const src = node.currentSrc || node.getAttribute('src') || '';
      if (src) return buildAssetInfo(node, 'src', src);
    }

    if (tagName === 'source' && node.getAttribute) {
      const src = node.getAttribute('src') || '';
      if (src) return buildAssetInfo(node, 'src', src);
    }

    const bgUrl = extractCssUrl(getComputedStyle(node).backgroundImage);
    if (bgUrl) {
      return buildAssetInfo(node, 'background', bgUrl);
    }

    return null;
  };

  const resolveImageAsset = (target) => {
    const directAsset = readAssetFromNode(target);
    if (directAsset) return directAsset;

    if (target && typeof target.querySelector === 'function') {
      const descendant = target.querySelector('img[src], img[data-src], video[poster], video[src], source[src]');
      if (descendant) {
        const descendantAsset = readAssetFromNode(descendant);
        if (descendantAsset) return descendantAsset;
      }
    }

    let current = target?.parentElement || null;
    while (current && current !== document.body && current !== document.documentElement) {
      const ancestorAsset = readAssetFromNode(current);
      if (ancestorAsset) return ancestorAsset;
      current = current.parentElement;
    }

    return null;
  };

  const buildBreadcrumb = (target) => {
    const breadcrumb = [];
    let current = target;
    let maxDepth = 6;

    while (current && current !== document.body && current !== document.documentElement && maxDepth > 0) {
      const tag = current.tagName ? current.tagName.toLowerCase() : '';
      const firstClass = current.className && typeof current.className === 'string'
        ? current.className.split(' ').filter((c) => c && !c.includes('wakti'))[0]
        : '';
      breadcrumb.unshift(firstClass ? tag + '.' + firstClass : tag);
      current = current.parentElement;
      maxDepth -= 1;
    }

    return breadcrumb;
  };

  const isMeaningfulSelectionTarget = (node) => {
    if (!node || node === document.body || node === document.documentElement || node.id === 'root') {
      return false;
    }

    const tagName = node.tagName ? node.tagName.toLowerCase() : '';
    if (!tagName) return false;

    if (/^(button|a|input|textarea|select|label|img|video|picture|svg)$/i.test(tagName)) {
      return true;
    }

    if (node.getAttribute) {
      if (node.getAttribute('role') === 'button') return true;
      if (node.getAttribute('data-wakti-visual-target') === 'true') return true;
      if (node.getAttribute('contenteditable') === 'true') return true;
    }

    if (typeof node.className === 'string' && /\b(btn|button|cta|link|chip|tab|pill|badge)\b/i.test(node.className)) {
      return true;
    }

    if (typeof node.onclick === 'function') return true;

    const text = (node.innerText || '').trim();
    if (/^(span|p|h1|h2|h3|h4|h5|h6|strong|em|small)$/i.test(tagName) && text.length > 0 && text.length <= 140) {
      return true;
    }

    return false;
  };

  const isLayoutContainer = (node) => {
    if (!node || !node.tagName) return false;

    const tagName = node.tagName.toLowerCase();
    const className = typeof node.className === 'string' ? node.className : '';
    const text = (node.innerText || '').trim();
    const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;

    if (/^(section|article|main|aside|nav|header|footer|form|ul|ol|div)$/i.test(tagName)) {
      if (rect && (rect.width > window.innerWidth * 0.45 || rect.height > window.innerHeight * 0.35)) {
        return true;
      }

      if (/\b(hero|banner|section|wrapper|container|layout|grid|row|col|content|inner|outer)\b/i.test(className)) {
        return true;
      }

      if (text.length > 140) {
        return true;
      }
    }

    return false;
  };

  const normalizeSelectionTarget = (target) => {
    if (!target) return null;

    let current = target;
    let best = target;
    let maxDepth = 5;

    while (current && current !== document.body && current !== document.documentElement && maxDepth > 0) {
      if (isMeaningfulSelectionTarget(current)) {
        best = current;
        break;
      }
      current = current.parentElement;
      maxDepth -= 1;
    }

    return best;
  };

  const getOverlayTarget = (target) => {
    const normalized = normalizeSelectionTarget(target);

    if (normalized && !isLayoutContainer(normalized)) {
      return normalized;
    }

    if (!target) return null;

    let current = target;
    let maxDepth = 5;

    while (current && current !== document.body && current !== document.documentElement && maxDepth > 0) {
      if (!isLayoutContainer(current)) {
        return current;
      }
      current = current.parentElement;
      maxDepth -= 1;
    }

    return normalized || target;
  };

  const updateOverlayForTarget = (target) => {
    const displayTarget = getOverlayTarget(target);

    if (!displayTarget || displayTarget === overlay || displayTarget === document.body || displayTarget === document.documentElement) {
      overlay.style.display = 'none';
      return null;
    }

    const rect = displayTarget.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    let labelText = displayTarget.tagName.toLowerCase();
    if (displayTarget.className && typeof displayTarget.className === 'string') {
      const firstClass = displayTarget.className.split(' ').filter(c => c && !c.includes('wakti'))[0];
      if (firstClass) labelText += '.' + firstClass;
    }
    label.innerText = labelText;

    return displayTarget;
  };

  const buildElementInfo = (target) => {
    const computedStyle = getComputedStyle(target);
    const assetInfo = resolveImageAsset(target);

    return {
      tagName: target.tagName.toLowerCase(),
      className: target.className || '',
      id: target.id || '',
      innerText: (target.innerText || '').trim().substring(0, 100),
      openingTag: target.outerHTML.split('>')[0] + '>',
      imageUrl: assetInfo?.url || '',
      imageTargetTagName: assetInfo?.tagName || '',
      imageTargetClassName: assetInfo?.className || '',
      imageTargetOpeningTag: assetInfo?.openingTag || '',
      imageTargetMode: assetInfo?.mode || undefined,
      computedStyle: {
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        fontSize: computedStyle.fontSize,
      },
      breadcrumb: buildBreadcrumb(target)
    };
  };

  const emitElementSelection = (target) => {
    const normalizedTarget = normalizeSelectionTarget(target);

    if (!normalizedTarget || normalizedTarget === overlay || normalizedTarget === document.body || normalizedTarget === document.documentElement || normalizedTarget.id === 'root') {
      return;
    }

    selectedElement = normalizedTarget;

    const elementInfo = buildElementInfo(normalizedTarget);
    console.log('[Wakti Inspector] Element selected:', elementInfo.tagName);

    window.parent.postMessage({
      type: 'WAKTI_ELEMENT_SELECTED',
      payload: elementInfo
    }, '*');
  };

  // 2. Listen for messages from Wakti parent
  window.addEventListener('message', (event) => {
    // Clone event.data to avoid readonly property errors
    let data;
    try {
      data = event.data ? JSON.parse(JSON.stringify(event.data)) : {};
    } catch (e) {
      data = {};
    }
    
    if (data.type === 'WAKTI_TOGGLE_INSPECT') {
      isInspectMode = data.enabled;
      console.log('[Wakti Inspector] Inspect mode:', isInspectMode);
      document.body.style.cursor = isInspectMode ? 'crosshair' : '';
      
      // Send acknowledgment back to parent
      window.parent.postMessage({ 
        type: 'WAKTI_INSPECT_MODE_CHANGED', 
        payload: { enabled: isInspectMode } 
      }, '*');
      
      if (!isInspectMode) {
        overlay.style.display = 'none';
        selectedElement = null;
        hoveredElement = null;
      }
    }
    // Ping/pong for debugging connection
    if (data.type === 'WAKTI_INSPECTOR_PING') {
      window.parent.postMessage({ type: 'WAKTI_INSPECTOR_PONG' }, '*');
    }
    if (data.type === 'WAKTI_SELECT_PARENT') {
      const target = selectedElement?.parentElement || hoveredElement?.parentElement;
      if (!target || target === document.body || target === document.documentElement || target.id === 'root') {
        return;
      }

      const parentTarget = updateOverlayForTarget(target) || target;
      emitElementSelection(parentTarget);
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

    hoveredElement = getOverlayTarget(target) || target;
    updateOverlayForTarget(target);
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

    hoveredElement = getOverlayTarget(target) || target;
    updateOverlayForTarget(target);
  }, { passive: true });

  // 5. Selection Click - Capture the element
  document.addEventListener('click', (e) => {
    if (!isInspectMode) return;
    
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (!target || target === overlay) return;
    emitElementSelection(target);
    
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
    emitElementSelection(target);
    
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
