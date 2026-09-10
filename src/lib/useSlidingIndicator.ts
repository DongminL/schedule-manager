import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/* how long the stretch-and-settle morph runs (matches --dur-slow + slack),
   same value the mobile tab bar uses in AppHeader */
const MORPH_MS = 420;

interface SlidingIndicator {
  /** attach to each segment button: `ref={setItemRef(i)}` */
  setItemRef: (index: number) => (el: HTMLElement | null) => void;
  /** inline style for the sliding indicator span (translate + size) */
  style: CSSProperties;
  /** false until the active item has been measured — keep the span hidden */
  ready: boolean;
  /** true for one morph cycle right after the active index changes */
  moving: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Measures the active segment button and returns a style that positions a single
 * absolutely-placed indicator over it. Works for equal- and unequal-width
 * segments and survives wrapping, resize, and web-font reflow.
 *
 * Uses the `translate` longhand (not `transform`) so the travel transition and
 * the `segIndicatorMorph` scale animation don't fight — same approach as the
 * mobile tab bar indicator.
 *
 * The parent must be `position: relative`; each button gets a ref via setItemRef.
 */
export function useSlidingIndicator(activeIndex: number, count: number): SlidingIndicator {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [box, setBox] = useState<Box | null>(null);
  const [moving, setMoving] = useState(false);
  const prevIndex = useRef(activeIndex);

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      refs.current[index] = el;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    function measure() {
      if (cancelled) return;
      const el = activeIndex >= 0 ? refs.current[activeIndex] : null;
      if (!el) {
        setBox(null);
        return;
      }
      setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    }

    measure();
    window.addEventListener("resize", measure);
    // button widths can shift once the Korean web font settles
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, count]);

  // flag the indicator as "moving" for one morph cycle on each real change
  useEffect(() => {
    if (prevIndex.current === activeIndex) return;
    prevIndex.current = activeIndex;
    setMoving(true);
    const id = setTimeout(() => setMoving(false), MORPH_MS);
    return () => clearTimeout(id);
  }, [activeIndex]);

  return {
    setItemRef,
    ready: box !== null,
    moving,
    style: box
      ? { translate: `${box.x}px ${box.y}px`, width: box.w, height: box.h }
      : {},
  };
}
