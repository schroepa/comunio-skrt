import { availabilityGate, robustMinutes, type AvailabilityKind } from "./availability";
import { canonicalClub, clubValues, rankPercentile, sameClub } from "./clubs";
import type { AvailabilityRecord, PlayerRecord, RatingRecord, SquadRow, ValueHistoryRecord } from "./directus";
import type { FixtureRecord } from "./fixtures";
import { expectedPoints, type Venue } from "./points";
import { formScore, formTrend, fixtureModifier, fixtureText, priceScore, priceVsForm, radarBadge, radarReason, type RadarBadge } from "./scores";

function asStatus(value: string | undefined): AvailabilityKind | null {
  if (value === "fit" || value === "fraglich" || value === "verletzt" || value === "gesperrt") return value;
  return null;
}

export function notesFor(playerId: number, ratings: RatingRecord[]): number[] {
  return ratings
    .filter((row) => row.player_id === playerId && typeof row.note === "number")
    .sort((a, b) => b.spieltag - a.spieltag)
    .map((row) => row.note);
}

export function minutesFor(playerId: number, ratings: RatingRecord[]): number[] {
  return ratings
    .filter((row) => row.player_id === playerId && typeof row.minuten_gespielt === "number")
    .sort((a, b) => b.spieltag - a.spieltag)
    .slice(0, 3)
    .map((row) => row.minuten_gespielt as number);
}

export function venueFor(player: PlayerRecord, fixtures: FixtureRecord[]): Venue {
  const next = fixtures.find(
    (row) => sameClub(row.heim_verein, player.verein) || sameClub(row.auswaerts_verein, player.verein),
  );
  if (!next) return "unknown";
  return sameClub(next.heim_verein, player.verein) ? "home" : "away";
}

export function nextOpponents(player: PlayerRecord, fixtures: FixtureRecord[]): string {
  const matches = fixtures
    .filter((row) => sameClub(row.heim_verein, player.verein) || sameClub(row.auswaerts_verein, player.verein))
    .slice(0, 3)
    .map((row) => (sameClub(row.heim_verein, player.verein) ? row.auswaerts_verein : row.heim_verein));
  return matches.length === 0 ? "—" : matches.join(", ");
}

export function previousMarketValue(playerId: number, history: ValueHistoryRecord[]): number | null {
  const rows = history
    .filter((row) => row.player_id === playerId)
    .slice()
    .sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  if (rows.length < 2) return null;
  return rows[1].marktwert;
}

function opponentPercentiles(player: PlayerRecord, fixtures: FixtureRecord[], values: Map<string, number>): number[] {
  const totals = [...values.values()];
  const names = nextOpponents(player, fixtures);
  if (names === "—") return [];
  const percentiles: number[] = [];
  for (const name of names.split(", ")) {
    const total = values.get(canonicalClub(name));
    if (total == null) continue;
    const percentile = rankPercentile(total, totals);
    if (percentile != null) percentiles.push(percentile);
  }
  return percentiles;
}

export type AlertRow = { player: string; badge: string; tone: "block" | "warn" };

export function kaderAlerts(
  squad: SquadRow[],
  players: PlayerRecord[],
  availability: AvailabilityRecord[],
  ratings: RatingRecord[],
  spieltag: number,
): AlertRow[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const statusByPlayer = new Map(
    availability.filter((row) => row.spieltag === spieltag).map((row) => [row.player_id, asStatus(row.status)]),
  );
  const alerts: AlertRow[] = [];
  for (const row of squad.filter((item) => item.im_kader)) {
    const player = byId.get(row.player_id);
    if (!player) continue;
    const gate = availabilityGate(statusByPlayer.get(row.player_id) ?? null);
    if (gate === "block") alerts.push({ player: player.name, badge: "Startet nicht", tone: "block" });
    else if (gate === "warn") alerts.push({ player: player.name, badge: "Unsicher, prüfen", tone: "warn" });
    else if (robustMinutes(minutesFor(row.player_id, ratings))) {
      alerts.push({ player: player.name, badge: "Wenig Spielzeit zuletzt", tone: "warn" });
    }
  }
  return alerts;
}

export type RadarRow = {
  player: PlayerRecord;
  market: number;
  form: number | null;
  notes: number[];
  opponents: string;
  badge: RadarBadge | "Kein Signal";
  reason: string;
  inSquad: boolean;
  divergence: number | null;
};

export function radarRows(
  players: PlayerRecord[],
  squadIds: Set<number>,
  ratings: RatingRecord[],
  availability: AvailabilityRecord[],
  fixtures: FixtureRecord[],
  spieltag: number,
  options: { includeHidden?: boolean; history?: ValueHistoryRecord[]; marketPlayers?: PlayerRecord[] } = {},
): RadarRow[] {
  const statusByPlayer = new Map(
    availability.filter((row) => row.spieltag === spieltag).map((row) => [row.player_id, asStatus(row.status)]),
  );
  const peers = new Map<string, number[]>();
  for (const player of players) {
    const list = peers.get(player.position) ?? [];
    list.push(player.aktueller_marktwert);
    peers.set(player.position, list);
  }
  const values = clubValues(options.marketPlayers ?? players);
  const rows: RadarRow[] = [];
  for (const player of players) {
    const notes = notesFor(player.id, ratings);
    const form = formScore(notes);
    const percentiles = opponentPercentiles(player, fixtures, values);
    const modifier = fixtureModifier(percentiles);
    const previous = previousMarketValue(player.id, options.history ?? []);
    const price = priceScore(player.aktueller_marktwert, peers.get(player.position) ?? [], previous);
    const gate = availabilityGate(statusByPlayer.get(player.id) ?? null);
    const inSquad = squadIds.has(player.id);
    const rawBadge = radarBadge({ inSquad, form, price, gate, modifier });
    if (rawBadge === "hidden" && !options.includeHidden) continue;
    const badge = rawBadge === "hidden" ? "Kein Signal" : rawBadge;
    const trend = formTrend(notes);
    const divergence = form == null ? null : form - price;
    const text = fixtureText(modifier, percentiles.length);
    rows.push({
      player,
      market: player.aktueller_marktwert,
      form,
      notes: notes.slice(0, 5),
      opponents: nextOpponents(player, fixtures),
      badge,
      reason: radarReason({
        trend,
        fixtureText: text,
        badge: badge === "Kein Signal" ? "Beobachten" : badge,
        priceVsForm: priceVsForm(form, price),
      }),
      inSquad,
      divergence,
    });
  }
  return rows;
}

export function playerPoints(
  player: PlayerRecord,
  ratings: RatingRecord[],
  availability: AvailabilityRecord[],
  fixtures: FixtureRecord[],
  spieltag: number,
  clubValueMap: Map<string, number>,
): { points: number; blocked: boolean } {
  const status = asStatus(availability.find((row) => row.player_id === player.id && row.spieltag === spieltag)?.status ?? undefined);
  const gate = availabilityGate(status);
  const percentiles = opponentPercentiles(player, fixtures, clubValueMap);
  return {
    points: expectedPoints({
      notesNewestFirst: notesFor(player.id, ratings),
      status,
      lastThreeMinutes: minutesFor(player.id, ratings),
      venue: venueFor(player, fixtures),
      fixtureModifier: fixtureModifier(percentiles),
    }),
    blocked: gate === "block",
  };
}
