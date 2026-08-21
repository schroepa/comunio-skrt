import { useCallback, useEffect, useRef, useState } from "react";
import { Liquid } from "liquid-gooey";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/kader", label: "Kader" },
  { href: "/radar", label: "Radar" },
  { href: "/kader-check", label: "Kader-Check" },
  { href: "/konkurrenz", label: "Konkurrenz" },
  { href: "/aufstellung", label: "Aufstellung" },
] as const;

function currentPathname(): string {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [path, setPath] = useState("/");
  const [pill, setPill] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>("a[aria-current='page']");
    if (!active) return;
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    setPill({
      left: box.left - navBox.left,
      top: box.top - navBox.top,
      width: box.width,
      height: box.height,
    });
  }, []);

  useEffect(() => {
    const sync = () => setPath(currentPathname());
    sync();
    document.addEventListener("astro:page-load", sync);
    return () => document.removeEventListener("astro:page-load", sync);
  }, []);

  useEffect(() => {
    measure();
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [path, measure]);

  return (
    <nav ref={navRef} className="liquid-nav relative shrink-0" aria-label="Hauptnavigation">
      <Liquid
        fill="var(--primary)"
        blur={10}
        contrast={18}
        className="relative flex items-center gap-1 rounded-full p-1"
        shadow="0 2px 10px color-mix(in oklch, var(--primary) 35%, transparent)"
      >
        {pill.width > 0 ? (
          <Liquid.Item effect="move" move={{ springiness: 0.52, trail: 0.5, stretch: 0.38, wobble: 0.4 }}>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full bg-transparent"
              style={{
                left: pill.left,
                top: pill.top,
                width: pill.width,
                height: pill.height,
              }}
            />
          </Liquid.Item>
        ) : null}
        {links.map((link) => {
          const active = path === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className="relative z-10 whitespace-nowrap rounded-full bg-transparent px-3 py-1.5 text-xs no-underline transition-colors sm:px-3 sm:text-sm"
              style={{
                color: active ? "var(--primary-foreground)" : "var(--foreground)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {link.label}
            </a>
          );
        })}
      </Liquid>
    </nav>
  );
}
