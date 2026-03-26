import { useState, useEffect, useRef } from 'preact/hooks';

interface ConnectionOverlayProps {
  connected: boolean;
  loading: boolean;
}

/** Grace period before showing the overlay (avoids flashing on brief reconnects). */
const GRACE_MS = 4000;

export function ConnectionOverlay({ connected, loading }: ConnectionOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const wasConnected = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
    }
  }, [connected]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (!connected && !loading && wasConnected.current) {
      // Server dropped — reset any in-progress fade and wait for grace period
      setFadingOut(false);
      timer.current = setTimeout(() => setVisible(true), GRACE_MS);
    } else if (connected && visible) {
      // Reconnected — fade out then hide
      setFadingOut(true);
      timer.current = setTimeout(() => {
        setVisible(false);
        setFadingOut(false);
      }, 600);
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [connected, loading, visible]);

  if (!visible) return null;

  return (
    <div
      class={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500
              ${fadingOut ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'rgba(6, 11, 24, 0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div class="text-center max-w-md px-6">
        {/* Dimmed icon */}
        <svg
          class="w-16 h-16 mx-auto mb-5 opacity-40"
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="512" height="512" rx="96" fill="#1e293b" />
          <path
            d="M128 192L208 256L128 320"
            stroke="#475569"
            stroke-width="32"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <line
            x1="240"
            y1="320"
            x2="384"
            y2="320"
            stroke="#475569"
            stroke-width="32"
            stroke-linecap="round"
          />
          <circle cx="176" cy="120" r="16" fill="#334155" />
          <circle cx="224" cy="120" r="16" fill="#334155" />
          <circle cx="272" cy="120" r="16" fill="#334155" />
        </svg>

        <h2 class="text-xl font-semibold text-slate-200 mb-2">Server disconnected</h2>
        <p class="text-sm text-slate-400 mb-4">
          The dashboard lost its connection. If you stopped the server, restart it:
        </p>
        <code
          class="inline-block text-sm px-3 py-1.5 rounded-md mb-5"
          style="background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.15); color: #38bdf8"
        >
          dev-dashboard
        </code>

        {/* Reconnecting indicator */}
        <div class="flex items-center justify-center gap-2 text-xs text-slate-500">
          <span
            class="w-2 h-2 rounded-full bg-amber-400"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
          />
          Reconnecting…
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
      `}</style>
    </div>
  );
}
