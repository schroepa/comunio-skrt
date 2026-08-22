import { describe, expect, it } from "vitest";
import { closeSidebarUi, isSidebarOpen, setSidebarOpen, type FlagRoot } from "../../src/lib/sidebar-drawer";

function flagRoot(initial: string[] = []): FlagRoot {
  const attrs = new Set(initial);
  return {
    hasAttribute: (name) => attrs.has(name),
    setAttribute: (name) => {
      attrs.add(name);
    },
    removeAttribute: (name) => {
      attrs.delete(name);
    },
  };
}

describe("setSidebarOpen", () => {
  it("sets and clears the open flag", () => {
    const root = flagRoot();
    expect(isSidebarOpen(root)).toBe(false);
    setSidebarOpen(root, true);
    expect(isSidebarOpen(root)).toBe(true);
    setSidebarOpen(root, false);
    expect(isSidebarOpen(root)).toBe(false);
  });

  it("marks the workspace inert only while open", () => {
    const root = flagRoot();
    const workspace = flagRoot();
    setSidebarOpen(root, true, workspace);
    expect(workspace.hasAttribute("inert")).toBe(true);
    setSidebarOpen(root, false, workspace);
    expect(workspace.hasAttribute("inert")).toBe(false);
  });

  it("marks the sidebar inert only while closed", () => {
    const root = flagRoot();
    const workspace = flagRoot();
    const sidebar = flagRoot(["inert"]);
    setSidebarOpen(root, true, workspace, sidebar);
    expect(sidebar.hasAttribute("inert")).toBe(false);
    expect(workspace.hasAttribute("inert")).toBe(true);
    setSidebarOpen(root, false, workspace, sidebar);
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(workspace.hasAttribute("inert")).toBe(false);
  });
});

describe("closeSidebarUi", () => {
  it("closes the drawer and restores focus to the toggle", () => {
    const root = flagRoot(["data-sidebar-open"]);
    const workspace = flagRoot(["inert"]);
    const sidebar = flagRoot();
    const toggle = { focused: false, focus() { this.focused = true; } };
    closeSidebarUi(root, workspace, sidebar, toggle);
    expect(isSidebarOpen(root)).toBe(false);
    expect(workspace.hasAttribute("inert")).toBe(false);
    expect(sidebar.hasAttribute("inert")).toBe(true);
    expect(toggle.focused).toBe(true);
  });
});
