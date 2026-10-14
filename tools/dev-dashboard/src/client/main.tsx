import { render } from 'preact';
import { App } from './App.js';

render(<App />, document.getElementById('app')!);

// Retire the PWA service worker (dev-dashboard-v1). Its only job was serving
// an offline fallback; the sw.js artifact stopped shipping when bundles became
// tree-buildable (the source was gitignored and absent from fresh checkouts).
// Registered clients keep a controlling worker with a cache fallback until the
// browser's hard cap, so unregister explicitly on boot and drop its caches.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister();
  });
  void caches.keys().then((keys) => {
    for (const key of keys) void caches.delete(key);
  });
}
