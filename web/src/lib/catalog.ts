import { availabilityGate, robustMinutes, type AvailabilityKind } from "./availability";
import type { AvailabilityRecord, PlayerRecord, RatingRecord, SquadRow } from "./directus";
import type { FixtureRecord } from "./fixtures";
import { expectedPoints, type Venue } from "./points";
import { formScore, formTrend, priceScore, priceVsForm, radarBadge, radarReason, type RadarBadge } from "./scores";

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
    (row) => row.heim_verein === player.verein || row.auswaerts_verein === player.verein,
  );
  if (!next) return "unknown";
  return next.heim_verein === player.verein ? "home" : "away";
}

export function nextOpponents(player: PlayerRecord, fixtures: FixtureRecord[]): string {
  const matches = fixtures
    .filter((row) => row.heim_verein === player.verein || row.auswaerts_verein === player.verein)
    .slice(0, 3)
    .map((row) => (row.heim_verein === player.verein ? row.auswaerts_verein : row.heim_verein));
  return matches.length === 0 ? "—" : matches.join(", ");
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
  opponents: string;
  badge: RadarBadge;
  reason: string;
  inSquad: boolean;
};

export function radarRows(
  players: PlayerRecord[],
  squadIds: Set<number>,
  ratings: RatingRecord[],
  availability: AvailabilityRecord[],
  fixtures: FixtureRecord[],
  spieltag: number,
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
  const rows: RadarRow[] = [];
  for (const player of players) {
    const notes = notesFor(player.id, ratings);
    const form = formScore(notes);
    const price = priceScore(player.aktueller_marktwert, peers.get(player.position) ?? []);
    const gate = availabilityGate(statusByPlayer.get(player.id) ?? null);
    const inSquad = squadIds.has(player.id);
    const badge = radarBadge({ inSquad, form, price, gate });
    if (badge === "hidden") continue;
    const trend = formTrend(notes);
    rows.push({
      player,
      market: player.aktueller_marktwert,
      form,
      opponents: nextOpponents(player, fixtures),
      badge,
      reason: radarReason({ trend, badge, priceVsForm: priceVsForm(form, price) }),
      inSquad,
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
): { points: number; blocked: boolean } {
  const status = asStatus(availability.find((row) => row.player_id === player.id && row.spieltag === spieltag)?.status ?? undefined);
  const gate = availabilityGate(status);
  return {
    points: expectedPoints({
      notesNewestFirst: notesFor(player.id, ratings),
      status,
      lastThreeMinutes: minutesFor(player.id, ratings),
      venue: venueFor(player, fixtures),
    }),
    blocked: gate === "block",
  };
}
