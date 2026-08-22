import { useEffect, useState } from "react";
import { closeSidebarUi, isSidebarOpen, setSidebarOpen } from "../lib/sidebar-drawer";

function workspace(): HTMLElement | null {
  return document.getElementById("app-workspace");
}

function sidebar(): HTMLElement | null {
  return document.getElementById("app-sidebar");
}

function isDesktop(): boolean {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function drawerSidebar(): HTMLElement | null {
  return isDesktop() ? null : sidebar();
}

function closeSidebar(restoreFocus = false) {
  const toggle = restoreFocus ? document.getElementById("sidebar-toggle") : null;
  closeSidebarUi(document.documentElement, workspace(), drawerSidebar(), toggle);
  if (isDesktop()) sidebar()?.removeAttribute("inert");
}

export default function SidebarToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setOpen(isSidebarOpen(root));
    const onLoad = () => {
      closeSidebar();
      sync();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isSidebarOpen(root)) {
        closeSidebar(true);
        sync();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-sidebar-open"] });
    sync();
    document.addEventListener("astro:page-load", onLoad);
    document.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
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
        setSidebarOpen(document.documentElement, next, workspace(), drawerSidebar());
        setOpen(next);
        if (next) document.getElementById("sidebar-close")?.focus();
        else document.getElementById("sidebar-toggle")?.focus();
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
