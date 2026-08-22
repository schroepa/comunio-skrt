export type FlagRoot = {
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
};

export function isSidebarOpen(root: FlagRoot): boolean {
  return root.hasAttribute("data-sidebar-open");
}

export function setSidebarOpen(root: FlagRoot, open: boolean, workspace?: FlagRoot | null): void {
  if (open) root.setAttribute("data-sidebar-open", "");
  else root.removeAttribute("data-sidebar-open");
  if (!workspace) return;
  if (open) workspace.setAttribute("inert", "");
  else workspace.removeAttribute("inert");
}
