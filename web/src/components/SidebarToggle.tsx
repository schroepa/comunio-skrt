import { useEffect, useState } from "react";
import { isSidebarOpen, setSidebarOpen } from "../lib/sidebar-drawer";

function workspace(): HTMLElement | null {
  return document.getElementById("app-workspace");
}

function closeSidebar() {
  setSidebarOpen(document.documentElement, false, workspace());
}

export default function SidebarToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(isSidebarOpen(document.documentElement));
    const onLoad = () => {
      closeSidebar();
      sync();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isSidebarOpen(document.documentElement)) {
        closeSidebar();
        sync();
        document.getElementById("sidebar-toggle")?.focus();
      }
    };
    document.addEventListener("astro:page-load", onLoad);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("astro:page-load", onLoad);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <button
      id="sidebar-toggle"
      type="button"
      className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border lg:hidden"
      aria-controls="app-sidebar"
      aria-expanded={open}
      aria-label={open ? "Menü schließen" : "Menü öffnen"}
      onClick={() => {
        const next = !isSidebarOpen(document.documentElement);
        setSidebarOpen(document.documentElement, next, workspace());
        setOpen(next);
        if (next) document.getElementById("sidebar-close")?.focus();
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
