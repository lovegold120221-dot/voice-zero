// src/components/FolderWatcher.tsx
//
// Headless component mounted once, near the App root. Owns the polling
// loop that drives the scan-and-sync pipeline. UI lives elsewhere — this
// component renders nothing.
//
// Cadence:
//   - 5 s while the agent is generating OR the page tab is visible AND the
//     user was active in the last 30 s (mousemove / keydown).
//   - 60 s otherwise.
// Always pauses on hidden tabs (no network / battery kept).
// Always tears down on userId change / unmount.

import { useEffect, useRef } from 'react';
import { scanAndSync, reattachPermission } from '../lib/localFolder';
import { detectCapability } from '../lib/localFolder';

interface Props {
  userId: string | null;
  /** True while an agent generation is in progress */
  agentActive?: boolean;
}

// Mute logging under automated browsers
const SILENT_IN_TESTS =
  typeof navigator !== 'undefined' && /Headless/i.test(navigator.userAgent);

export function FolderWatcher({ userId, agentActive = false }: Props) {
  const lastActiveRef = useRef<number>(Date.now());
  const visibleRef = useRef<boolean>(
    typeof document === 'undefined' ? true : !document.hidden,
  );

  // Track user activity to pace polling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onActivity() {
      lastActiveRef.current = Date.now();
    }
    function onVisibility() {
      visibleRef.current = !document.hidden;
    }
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Main polling loop
  useEffect(() => {
    if (!userId) return;
    const capability = detectCapability();
    if (capability !== 'full') return; // no native picker — skip the loop

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      // Cadence adaptive
      const isVisible = visibleRef.current;
      const isActive =
        isVisible &&
        (agentActive || Date.now() - lastActiveRef.current < 30_000);
      const wait = isActive ? 5_000 : 60_000;
      timer = setTimeout(tick, wait);

      // Don't scan if the tab is fully hidden to spare battery
      if (!isVisible) return;

      try {
        const { counters, state } = await scanAndSync(userId!);
        if (cancelled) return;
        if (
          !SILENT_IN_TESTS &&
          (counters.createdKB + counters.replacedKB + counters.deletedKB > 0 ||
            counters.errors.length > 0)
        ) {
          console.info('[LocalFolder] scan:', {
            scanned: counters.scanned,
            createdKB: counters.createdKB,
            replacedKB: counters.replacedKB,
            deletedKB: counters.deletedKB,
            mirroredOPFS: counters.mirroredOPFS,
            errors: counters.errors.length,
          });
        }
        void state;
      } catch (e) {
        if (!SILENT_IN_TESTS) console.warn('[LocalFolder] scan threw', e);
      }
    }

    // First tick — kick off immediately and re-verify permission at wake
    (async () => {
      const perm = await reattachPermission(userId!);
      if (perm === 'granted') {
        void tick();
      }
      // otherwise we leave it to the user to tap "Reconnect" via the panel.
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, agentActive]);

  return null;
}
