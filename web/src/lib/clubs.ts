const CLUB_GROUPS: readonly string[][] = [
  ["FC Bayern München", "Bayern München"],
  ["TSG Hoffenheim", "1899 Hoffenheim", "TSG 1899 Hoffenheim"],
  ["Bayer 04 Leverkusen", "Bayer Leverkusen"],
  ["RB Leipzig", "RasenBallsport Leipzig"],
  ["Borussia Mönchengladbach", "Borussia M'gladbach"],
  ["1. FC Union Berlin", "1.FC Union Berlin", "Union Berlin"],
  ["1. FSV Mainz 05", "1.FSV Mainz 05", "Mainz 05"],
  ["1. FC Heidenheim", "1. FC Heidenheim 1846"],
  ["1. FC Köln", "1.FC Köln"],
  ["SC Freiburg", "Sport-Club Freiburg"],
  ["VfL Bochum", "VfL Bochum 1848"],
];

const CANONICAL_BY_ALIAS = new Map<string, string>();
for (const group of CLUB_GROUPS) {
  const canonical = group[0];
  for (const name of group) {
    CANONICAL_BY_ALIAS.set(name.trim().toLowerCase(), canonical);
  }
}

export function canonicalClub(name: string): string {
  const trimmed = name.trim();
  return CANONICAL_BY_ALIAS.get(trimmed.toLowerCase()) ?? trimmed;
}

export function sameClub(a: string, b: string): boolean {
  return canonicalClub(a) === canonicalClub(b);
}

export function clubValues(players: Array<{ verein: string; aktueller_marktwert: number }>): Map<string, number> {
  const sums = new Map<string, number>();
  for (const player of players) {
    const key = canonicalClub(player.verein);
    sums.set(key, (sums.get(key) ?? 0) + player.aktueller_marktwert);
  }
  return sums;
}

export function rankPercentile(value: number, peers: number[]): number | null {
  if (peers.length <= 1) return null;
  const sorted = [...peers].sort((a, b) => a - b);
  const index = sorted.findIndex((peer) => peer >= value);
  const rank = index === -1 ? sorted.length - 1 : index;
  return (rank / (sorted.length - 1)) * 100;
}
