// Android Chrome scrolling fix - EXTREME VERSION for Honor phones
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on Android
  const isAndroid = /android/i.test(navigator.userAgent);
  // Special detection for Honor phones
  const isHonor = /honor|huawei/i.test(navigator.userAgent);
  
  function applyScrollFix() {
    // Add special Android class
    document.documentElement.classList.add('android-device');
    if (isHonor) document.documentElement.classList.add('honor-device');
    
    // AGGRESSIVE: Fix body and html dimensions
    document.documentElement.style.height = '100%';
    document.documentElement.style.width = '100%';
    document.documentElement.style.position = 'relative';
    document.documentElement.style.overflowY = 'scroll';
    document.documentElement.style.overflowX = 'hidden';
    document.documentElement.style.webkitOverflowScrolling = 'touch';
    
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100%';
    document.body.style.width = '100%';
    document.body.style.position = 'relative';
    document.body.style.overflowY = 'visible';
    document.body.style.overflowX = 'hidden';
    
    // Force all possible containers to be scrollable
    const rootElem = document.getElementById('root');
    if (rootElem) {
      rootElem.style.height = 'auto';
      rootElem.style.minHeight = '100%';
      rootElem.style.overflowY = 'visible';
      rootElem.style.position = 'relative';
    }
    
    // Inject CSS with !important flags everywhere
    const style = document.createElement('style');
    style.textContent = `
      /* Global fixes - with !important to override everything else */
      html, body {
        position: relative !important;
      }
      
      html {
        height: 100% !important;
        overflow-y: scroll !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      body {
        height: auto !important;
        min-height: 100% !important;
        overflow-y: visible !important;
        overflow-x: hidden !important;
      }
      
      #root {
        height: auto !important;
        min-height: 100% !important;
        overflow-y: visible !important;
        position: relative !important;
      }
      
      /* Honor specific - even more aggressive */
      html.honor-device {
        position: static !important;
        display: block !important;
      }
      
      html.honor-device body {
        position: static !important;
        display: block !important;
      }
      
      /* Target all main containers */
      main, [role='main'], .app-container, .mobile-container, .app-layout-mobile, 
      .wakti-ai-container, .dashboard-container {
        height: auto !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: auto !important;
        position: relative !important;
      }
      
      /* Force all containers to expand */
      *, *::before, *::after {
        max-height: 999999px !important;
      }
    `;
    
    document.head.appendChild(style);
    
    // Force iOS-like momentum scrolling behavior
    const scrollEnabler = document.createElement('div');
    scrollEnabler.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0';
    document.body.appendChild(scrollEnabler);
    
    // Enable scroll with touch events
    document.addEventListener('touchstart', function() {}, {passive: true});
    document.addEventListener('touchmove', function() {}, {passive: true});
  }
  
  // Apply immediately
  if (isAndroid) {
    applyScrollFix();
  }
  
  // And also after a delay to ensure it works after other scripts run
  setTimeout(function() {
    if (isAndroid) {
      applyScrollFix();
    }
  }, 500);
  
  // Apply one more time after full load
  window.addEventListener('load', function() {
    if (isAndroid) {
      applyScrollFix();
    }
  });
});
