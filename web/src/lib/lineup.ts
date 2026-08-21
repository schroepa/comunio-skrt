export type LineupPosition = "Torwart" | "Abwehr" | "Mittelfeld" | "Sturm";

export type LineupCandidate = {
  id: number;
  position: LineupPosition;
  points: number;
  blocked: boolean;
};

export type LineupResult =
  | { ok: true; eleven: LineupCandidate[]; bench: LineupCandidate[]; formation: string; total: number }
  | { ok: false; reason: "too_small" | "no_goalkeeper" };

function counts(players: LineupCandidate[]) {
  return {
    tw: players.filter((player) => player.position === "Torwart").length,
    abw: players.filter((player) => player.position === "Abwehr").length,
    mf: players.filter((player) => player.position === "Mittelfeld").length,
    st: players.filter((player) => player.position === "Sturm").length,
  };
}

function isLegal(players: LineupCandidate[]): boolean {
  if (players.length !== 11) return false;
  const { tw, abw, mf, st } = counts(players);
  return tw === 1 && abw >= 3 && abw <= 5 && mf >= 2 && mf <= 5 && st >= 1 && st <= 3;
}

export function pickLineup(squad: LineupCandidate[]): LineupResult {
  const eligible = squad.filter((player) => !player.blocked);
  const keepers = eligible.filter((player) => player.position === "Torwart").sort((a, b) => b.points - a.points);
  const outfield = eligible
    .filter((player) => player.position !== "Torwart")
    .sort((a, b) => b.points - a.points);
  if (keepers.length === 0) return { ok: false, reason: "no_goalkeeper" };
  if (eligible.length < 11) return { ok: false, reason: "too_small" };

  const keeper = keepers[0];
  const n = outfield.length;
  let best: LineupCandidate[] | null = null;
  let bestSum = -1;

  const limit = Math.min(n, 18);
  const pick = (start: number, chosen: LineupCandidate[]) => {
    if (chosen.length === 10) {
      const eleven = [keeper, ...chosen];
      if (!isLegal(eleven)) return;
      const total = eleven.reduce((sum, player) => sum + player.points, 0);
      if (total > bestSum) {
        bestSum = total;
        best = eleven;
      }
      return;
    }
    if (chosen.length + (n - start) < 10) return;
    for (let index = start; index < n; index++) {
      chosen.push(outfield[index]);
      pick(index + 1, chosen);
      chosen.pop();
      if (best && start === 0 && index > limit) break;
    }
  };

  if (n <= 16) {
    pick(0, []);
  } else {
    const greedy: LineupCandidate[] = [keeper];
    const need: Record<Exclude<LineupPosition, "Torwart">, number> = { Abwehr: 3, Mittelfeld: 2, Sturm: 1 };
    for (const pos of ["Abwehr", "Mittelfeld", "Sturm"] as const) {
      const pool = outfield.filter((player) => player.position === pos);
      greedy.push(...pool.slice(0, need[pos]));
    }
    for (const player of outfield) {
      if (greedy.includes(player)) continue;
      const next = [...greedy, player];
      const { abw, mf, st } = counts(next);
      if (abw > 5 || mf > 5 || st > 3) continue;
      greedy.push(player);
      if (greedy.length === 11) break;
    }
    if (isLegal(greedy)) best = greedy;
  }

  if (!best) return { ok: false, reason: "too_small" };
  const eleven = best;
  const elevenIds = new Set(eleven.map((player) => player.id));
  const bench = squad.filter((player) => !elevenIds.has(player.id));
  const { abw, mf, st } = counts(eleven);
  const total = Math.round(eleven.reduce((sum, player) => sum + player.points, 0) * 10) / 10;
  return { ok: true, eleven, bench, formation: `${abw}-${mf}-${st}`, total };
}
