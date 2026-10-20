import { useLayoutEffect, useRef } from "react";

const MAX_REMEMBERED_POSITIONS = 100;
const scrollTops = new Map<string, number>();

function remember(key: string, scrollTop: number) {
  scrollTops.delete(key);
  if (scrollTop > 0) scrollTops.set(key, scrollTop);
  const oldest = scrollTops.keys().next();
  if (scrollTops.size > MAX_REMEMBERED_POSITIONS && !oldest.done) scrollTops.delete(oldest.value);
}

/**
 * Gives a scrolled surface back its position after it remounts, as the code
 * view does. Attach the returned ref to an element inside the `ScrollArea`.
 * The position is read when the surface unmounts: reading it from scroll events
 * would record the clamp that happens while late content is still laying out.
 */
export function useRememberedScroll(key: string) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = ref.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    const saved = scrollTops.get(key);
    if (saved !== undefined) viewport.scrollTop = saved;
    return () => remember(key, viewport.scrollTop);
  }, [key]);

  return ref;
}
