import { render } from 'preact';
import { App } from './App.js';

render(<App />, document.getElementById('app')!);

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // SW registration failed — app works fine without it
    });
  });
}
