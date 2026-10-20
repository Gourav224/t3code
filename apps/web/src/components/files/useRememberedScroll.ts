import { useLayoutEffect, useRef } from "react";

import { observeResize } from "~/lib/observeResize";

const MAX_REMEMBERED_POSITIONS = 100;
const scrollTops = new Map<string, number>();
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

function remember(key: string, scrollTop: number) {
  scrollTops.delete(key);
  if (scrollTop > 0) scrollTops.set(key, scrollTop);
  const oldest = scrollTops.keys().next();
  if (scrollTops.size > MAX_REMEMBERED_POSITIONS && !oldest.done) scrollTops.delete(oldest.value);
}

/**
 * Gives a scrolled surface back its position after it remounts, as the code
 * view does. Attach the returned ref to an element inside the `ScrollArea`.
 *
 * Images and other late content can leave the document too short to reach the
 * saved position when it mounts, so the restore repeats as the content resizes
 * until it lands or the user scrolls. The position is read when the surface
 * unmounts rather than from scroll events, and an unfinished restore keeps the
 * remembered position, because the viewport is still clamped short of it.
 */
export function useRememberedScroll(key: string) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = ref.current;
    const viewport = content?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!content || !viewport) return;

    const saved = scrollTops.get(key);
    const takeover = new AbortController();
    let restoring = saved !== undefined;
    let stopObserving = () => {};
    const stop = () => {
      restoring = false;
      stopObserving();
      takeover.abort();
    };
    const restore = () => {
      if (saved === undefined) return;
      viewport.scrollTop = saved;
      if (viewport.scrollTop >= saved) stop();
    };

    if (saved !== undefined) {
      restore();
      if (restoring) {
        stopObserving = observeResize(content, restore);
        for (const type of USER_SCROLL_EVENTS) {
          viewport.addEventListener(type, stop, { passive: true, signal: takeover.signal });
        }
      }
    }

    return () => {
      if (!restoring) remember(key, viewport.scrollTop);
      stop();
    };
  }, [key]);

  return ref;
}
