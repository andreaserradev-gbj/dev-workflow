import { useState, useRef, useCallback } from 'preact/hooks';

interface UseClipboardResult {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  error: string | null;
}

const FEEDBACK_MS = 2000;

export function useClipboard(): UseClipboardResult {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Clipboard write failed';
      setError(message);
      setCopied(false);
    }
  }, []);

  return { copy, copied, error };
}
