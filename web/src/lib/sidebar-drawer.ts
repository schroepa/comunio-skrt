export type FlagRoot = {
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export type Focusable = {
  focus(): void;
};

export function isSidebarOpen(root: FlagRoot): boolean {
  return root.hasAttribute("data-sidebar-open");
}

export function setSidebarOpen(
  root: FlagRoot,
  open: boolean,
  workspace?: FlagRoot | null,
  sidebar?: FlagRoot | null,
): void {
  if (open) root.setAttribute("data-sidebar-open", "");
  else root.removeAttribute("data-sidebar-open");
  if (workspace) {
    if (open) workspace.setAttribute("inert", "");
    else workspace.removeAttribute("inert");
  }
  if (sidebar) {
    if (open) sidebar.removeAttribute("inert");
    else sidebar.setAttribute("inert", "");
  }
}

export function closeSidebarUi(
  root: FlagRoot,
  workspace?: FlagRoot | null,
  sidebar?: FlagRoot | null,
  toggle?: Focusable | null,
): void {
  setSidebarOpen(root, false, workspace, sidebar);
  toggle?.focus();
}
