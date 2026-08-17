"use client";

import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";

export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
) {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Callback ref (not useRef+useEffect): the observed element can mount later
  // than the component itself (e.g. behind a tab switch), so we must attach
  // the observer whenever the DOM node actually appears, not just once on mount.
  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, ...options }
    );
    observer.observe(el);
    observerRef.current = observer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, visible };
}

export function revealStyle(visible: boolean, delayMs = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
    transition: `opacity .5s cubic-bezier(.2,.7,.3,1) ${delayMs}ms, transform .5s cubic-bezier(.2,.7,.3,1) ${delayMs}ms`,
  };
}
