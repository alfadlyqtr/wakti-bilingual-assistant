// Android scrolling support - lightweight version
// Only adds device classes and passive touch listeners.
// All layout/overflow is handled by CSS in index.css and AppLayout.tsx.
document.addEventListener('DOMContentLoaded', function() {
  var isAndroid = /android/i.test(navigator.userAgent);
  if (!isAndroid) return;

  document.documentElement.classList.add('android-device');
  if (/honor|huawei/i.test(navigator.userAgent)) {
    document.documentElement.classList.add('honor-device');
  }

  // Passive touch listeners help some Android WebViews recognise scroll gestures
  document.addEventListener('touchstart', function() {}, {passive: true});
  document.addEventListener('touchmove', function() {}, {passive: true});
});
