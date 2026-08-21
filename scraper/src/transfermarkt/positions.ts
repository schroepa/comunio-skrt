export type DirectusPosition = "Torwart" | "Abwehr" | "Mittelfeld" | "Sturm";

const RULES: Array<{ needle: string; pos: DirectusPosition }> = [
  { needle: "torwart", pos: "Torwart" },
  { needle: "keeper", pos: "Torwart" },
  { needle: "innenverteidiger", pos: "Abwehr" },
  { needle: "linksverteidiger", pos: "Abwehr" },
  { needle: "rechtsverteidiger", pos: "Abwehr" },
  { needle: "abwehr", pos: "Abwehr" },
  { needle: "libero", pos: "Abwehr" },
  { needle: "mittelfeld", pos: "Mittelfeld" },
  { needle: "flügel", pos: "Mittelfeld" },
  { needle: "außen", pos: "Mittelfeld" },
  { needle: "stürmer", pos: "Sturm" },
  { needle: "sturm", pos: "Sturm" },
  { needle: "mittelstürmer", pos: "Sturm" },
  { needle: "hängende spitze", pos: "Sturm" },
];

export function mapPosition(raw: string): DirectusPosition | null {
  const haystack = raw.toLowerCase();
  for (const { needle, pos } of RULES) {
    if (haystack.includes(needle)) return pos;
  }
  return null;
}
