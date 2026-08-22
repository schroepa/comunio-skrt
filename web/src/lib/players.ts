import type { PlayerRecord } from "./directus";

export type PlayerFilters = {
  q: string;
  position: string;
  verein: string;
  mwMin: number | null;
  mwMax: number | null;
};

export const PLAYER_POSITIONS = ["Torwart", "Abwehr", "Mittelfeld", "Sturm"] as const;

export const SEARCH_RESULT_LIMIT = 80;

function parseBound(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parsePlayerFilters(params: URLSearchParams): PlayerFilters {
  return {
    q: (params.get("q") ?? "").trim(),
    position: params.get("position") ?? "",
    verein: params.get("verein") ?? "",
    mwMin: parseBound(params.get("mw_min")),
    mwMax: parseBound(params.get("mw_max")),
  };
}

export function hasPlayerFilters(filters: PlayerFilters): boolean {
  return (
    filters.q.length > 0 ||
    filters.position.length > 0 ||
    filters.verein.length > 0 ||
    filters.mwMin != null ||
    filters.mwMax != null
  );
}

export function catalogFiltersActive(
  filters: PlayerFilters,
  extras: { onlySquad?: boolean; sortChanged?: boolean } = {},
): boolean {
  return hasPlayerFilters(filters) || Boolean(extras.onlySquad) || Boolean(extras.sortChanged);
}

export function uniqueClubs(players: Array<Pick<PlayerRecord, "verein">>): string[] {
  return [...new Set(players.map((player) => player.verein).filter((name) => name.length > 0))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
}

export function filterPlayers<T extends PlayerRecord>(players: T[], filters: PlayerFilters): T[] {
  const needle = filters.q.toLowerCase();
  return players.filter((player) => {
    if (needle && !player.name.toLowerCase().includes(needle)) return false;
    if (filters.position && player.position !== filters.position) return false;
    if (filters.verein && player.verein !== filters.verein) return false;
    if (filters.mwMin != null && player.aktueller_marktwert < filters.mwMin) return false;
    if (filters.mwMax != null && player.aktueller_marktwert > filters.mwMax) return false;
    return true;
  });
}
