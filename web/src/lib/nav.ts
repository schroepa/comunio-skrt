export type NavLink = {
  href: string;
  label: string;
};

export type NavGroup = {
  title: string;
  links: readonly NavLink[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  { title: "Büro", links: [{ href: "/", label: "Übersicht" }] },
  {
    title: "Kader",
    links: [
      { href: "/kader", label: "Mein Kader" },
      { href: "/kader-check", label: "Check" },
      { href: "/aufstellung", label: "Aufstellung" },
    ],
  },
  { title: "Transfermarkt", links: [{ href: "/radar", label: "Radar" }] },
  { title: "Liga", links: [{ href: "/konkurrenz", label: "Konkurrenz" }] },
];

export const NAV_LINKS = NAV_GROUPS.flatMap((group) => group.links);

export function currentPathname(path: string): string {
  const clean = path.replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}
