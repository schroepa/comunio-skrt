import { useEffect, useState } from "react";
import { Liquid } from "liquid-gooey";
import { useLiquidPill } from "../hooks/use-liquid-pill";
import { currentPathname, NAV_GROUPS } from "../lib/nav";

type Props = {
  currentPath?: string;
};

export default function SidebarNav({ currentPath = "/" }: Props) {
  const [path, setPath] = useState(() =>
    currentPathname(typeof window !== "undefined" ? window.location.pathname : currentPath),
  );
  const { rootRef, pill } = useLiquidPill<HTMLDivElement>(path);

  useEffect(() => {
    const sync = () => setPath(currentPathname(window.location.pathname));
    sync();
    document.addEventListener("astro:page-load", sync);
    document.addEventListener("astro:after-swap", sync);
    return () => {
      document.removeEventListener("astro:page-load", sync);
      document.removeEventListener("astro:after-swap", sync);
    };
  }, []);

  return (
    <nav className="liquid-nav" aria-label="Hauptnavigation">
      <div ref={rootRef} className="relative">
        <Liquid
          fill="var(--sidebar-primary)"
          blur={8}
          contrast={18}
          className="relative flex flex-col gap-5 rounded-xl"
          shadow="0 2px 8px color-mix(in oklch, var(--sidebar-primary) 25%, transparent)"
        >
          {pill.width > 0 ? (
            <Liquid.Item effect="move" move={{ springiness: 0.55, trail: 0.4, stretch: 0.28, wobble: 0.3 }}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-lg bg-transparent"
                style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }}
              />
            </Liquid.Item>
          ) : null}
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5 p-1">
                {group.links.map((link) => {
                  const active = path === link.href;
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      data-liquid-active={active ? "true" : undefined}
                      className="relative z-10 flex min-h-11 items-center rounded-lg bg-transparent px-3 text-sm no-underline"
                      style={{
                        color: active ? "var(--sidebar-primary-foreground)" : "var(--sidebar-foreground)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </Liquid>
      </div>
    </nav>
  );
}
