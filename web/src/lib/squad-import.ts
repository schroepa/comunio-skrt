import type { PlayerRecord } from "./directus";

export const SQUAD_IMPORT_LIMIT = 80;

const POSITION_HEADER =
  /^(tor|torwart|abwehr|mittelfeld|sturm)(\s*\(\d+\))?$/i;
const MARKET_VALUE_TAIL = /\s+\d{1,3}(?:\.\d{3})+$/;
const NUMERIC_LINE = /^\d[\d.\s]*$/;

export type SquadImportMatch =
  | { query: string; status: "matched"; player: PlayerRecord }
  | { query: string; status: "ambiguous"; players: PlayerRecord[] }
  | { query: string; status: "unmatched" };

export type SquadImportSummary = {
  matched: number;
  ambiguous: number;
  unmatched: number;
};

export function parseSquadPaste(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = stripMarketValue(raw.trim());
    if (!isPlayerNameLine(line)) continue;

    const key = normalizeName(line);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(line);
    if (names.length >= SQUAD_IMPORT_LIMIT) break;
  }

  return names;
}

export function matchSquadImport(queries: string[], catalog: PlayerRecord[]): SquadImportMatch[] {
  return queries.map((query) => {
    const players = catalog.filter((player) => matchesPlayer(query, player));
    if (players.length === 1) return { query, status: "matched", player: players[0] };
    if (players.length > 1) return { query, status: "ambiguous", players };
    return { query, status: "unmatched" };
  });
}

export function parseImportPlayerIds(values: Iterable<unknown>): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const id = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= SQUAD_IMPORT_LIMIT) break;
  }
  return ids;
}

export function summarizeSquadImport(matches: SquadImportMatch[]): SquadImportSummary {
  return {
    matched: matches.filter((row) => row.status === "matched").length,
    ambiguous: matches.filter((row) => row.status === "ambiguous").length,
    unmatched: matches.filter((row) => row.status === "unmatched").length,
  };
}

function stripMarketValue(line: string): string {
  return line.replace(MARKET_VALUE_TAIL, "").trim();
}

function isPlayerNameLine(line: string): boolean {
  if (line.length < 2) return false;
  if (NUMERIC_LINE.test(line)) return false;
  if (POSITION_HEADER.test(line)) return false;
  return normalizeName(line).length >= 2;
}

function matchesPlayer(query: string, player: PlayerRecord): boolean {
  const q = tokens(query);
  const n = tokens(player.name);
  if (q.length === 0 || n.length === 0) return false;
  if (q.join(" ") === n.join(" ")) return true;
  if (isTokenSuffix(q, n)) return true;
  if (q.length === 2 && q[0].length === 1 && n.length >= 2) {
    return n[n.length - 1] === q[1] && n[0].startsWith(q[0]);
  }
  return false;
}

function isTokenSuffix(query: string[], name: string[]): boolean {
  if (query.length > name.length) return false;
  const tail = name.slice(-query.length);
  return tail.every((token, index) => token === query[index]);
}

function tokens(value: string): string[] {
  return normalizeName(value).split(" ").filter(Boolean);
}

function normalizeName(value: string): string {
  return value
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
