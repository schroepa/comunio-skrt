import { describe, expect, it } from "vitest";
import { isSidebarOpen, setSidebarOpen, type FlagRoot } from "../../src/lib/sidebar-drawer";

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
});
