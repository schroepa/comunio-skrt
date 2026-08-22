import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useLiquidPill<T extends HTMLElement = HTMLElement>(activeKey: string) {
  const rootRef = useRef<T>(null);
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("[data-liquid-active='true']");
    if (!active) {
      setPill((prev) => (prev.width === 0 && prev.height === 0 ? prev : { left: 0, top: 0, width: 0, height: 0 }));
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    setPill({
      left: box.left - rootBox.left,
      top: box.top - rootBox.top,
      width: box.width,
      height: box.height,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeKey, measure]);

  return { rootRef, pill };
}
