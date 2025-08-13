export async function adminSwBypass() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        try { await r.unregister(); } catch {}
      }
    }
  } catch {}
  try {
    if (typeof caches !== 'undefined' && caches.keys) {
      const keys = await caches.keys();
      for (const k of keys) {
        try { await caches.delete(k); } catch {}
      }
    }
  } catch {}
  try { localStorage.removeItem('progressier'); } catch {}
  try { localStorage.removeItem('pwaInstalled'); } catch {}
}