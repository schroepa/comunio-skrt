import { Liquid } from "liquid-gooey";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/radar", label: "Radar" },
  { href: "/kader-check", label: "Kader-Check" },
] as const;

type Props = { currentPath: string };

export default function Nav({ currentPath }: Props) {
  return (
    <nav className="liquid-nav" aria-label="Hauptnavigation">
      <Liquid
        fill="var(--card)"
        blur={8}
        contrast={18}
        className="flex items-center gap-1 rounded-full p-1"
        shadow="0 2px 8px rgba(0,0,0,.35)"
      >
        {links.map((link) => {
          const active = currentPath === link.href;
          return (
            <Liquid.Item key={link.href} morph={{ shape: true }} transition="bouncy">
              <a
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="bg-transparent px-4 py-2 text-sm text-foreground no-underline"
                style={{ fontWeight: active ? 600 : 400 }}
              >
                {link.label}
              </a>
            </Liquid.Item>
          );
        })}
      </Liquid>
    </nav>
  );
}
