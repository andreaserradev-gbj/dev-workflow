import { useState, useCallback } from 'preact/hooks';

interface UseNotificationsResult {
  enabled: boolean;
  toggle: () => Promise<void>;
  permissionDenied: boolean;
}

export function useNotifications(): UseNotificationsResult {
  const [enabled, setEnabled] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const toggle = useCallback(async () => {
    if (enabled) {
      // Disable
      setEnabled(false);
      await persistConfig(false);
      return;
    }

    // Enable — request permission first
    if (typeof Notification === 'undefined') {
      setPermissionDenied(true);
      return;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied') {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);
    setEnabled(true);
    await persistConfig(true);
  }, [enabled]);

  return { enabled, toggle, permissionDenied };
}

export function notifyFeatureUpdate(project: string, feature: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  new Notification(`Updated: ${feature}`, {
    body: `Project: ${project}`,
    tag: `${project}/${feature}`,
  });
}

async function persistConfig(notifications: boolean): Promise<void> {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications }),
    });
  } catch {
    // Best-effort — don't break the UI if config save fails
  }
}
