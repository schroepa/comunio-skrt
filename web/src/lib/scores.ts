const WEIGHTS = [0.35, 0.25, 0.2, 0.12, 0.08] as const;

export function noteToFormPoints(note: number): number {
  return Math.min(100, Math.max(0, ((6 - note) / 5) * 100));
}

export function formScore(notesNewestFirst: number[]): number | null {
  if (notesNewestFirst.length === 0) return null;
  const used = notesNewestFirst.slice(0, 5);
  const weights = WEIGHTS.slice(0, used.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const weighted = used.reduce((sum, note, index) => sum + noteToFormPoints(note) * weights[index], 0);
  return weighted / weightSum;
}

export function priceScore(value: number, peerValues: number[], previousValue?: number | null): number {
  const peer =
    peerValues.length <= 1
      ? 50
      : (() => {
          const sorted = [...peerValues].sort((a, b) => a - b);
          const index = sorted.findIndex((peer) => peer >= value);
          const rank = index === -1 ? sorted.length - 1 : index;
          return (rank / (sorted.length - 1)) * 100;
        })();
  if (previousValue == null || previousValue <= 0) return peer;
  const trend = Math.min(100, Math.max(0, 50 + ((value - previousValue) / previousValue) * 250));
  return 0.6 * peer + 0.4 * trend;
}

export type RadarBadge = "Kaufen" | "Verkaufen" | "Halten" | "Beobachten" | "Nicht verfügbar";
export type FixtureModifier = -1 | 0 | 1;
export type FixtureText = "günstige Gegner" | "gemischte Gegner" | "schwere Gegner" | "Gegner unbekannt";

export function radarBadge(options: {
  inSquad: boolean;
  form: number | null;
  price: number;
  gate: "block" | "warn" | "ok";
  modifier?: FixtureModifier;
}): RadarBadge | "hidden" {
  if (options.gate === "block") return "Nicht verfügbar";
  if (options.form == null) return options.inSquad ? "Beobachten" : "hidden";
  const divergence = options.form - options.price;
  const modifier = options.modifier ?? 0;
  if (options.inSquad) {
    if (divergence <= -15) return "Verkaufen";
    if (divergence > 5) return "Halten";
    return "Beobachten";
  }
  if (divergence >= 15) return modifier >= 0 ? "Kaufen" : "Beobachten";
  if (divergence > 5) return "Beobachten";
  return "hidden";
}

export function formTrend(notesNewestFirst: number[]): "steigend" | "stabil" | "fallend" {
  if (notesNewestFirst.length < 2) return "stabil";
  const newest = notesNewestFirst[0];
  const older = notesNewestFirst[notesNewestFirst.length - 1];
  if (newest < older - 0.3) return "steigend";
  if (newest > older + 0.3) return "fallend";
  return "stabil";
}

export function radarReason(options: {
  trend: "steigend" | "stabil" | "fallend";
  fixtureText: FixtureText;
  priceVsForm: "hinkt" | "passt" | "voraus";
  badge: RadarBadge;
}): string {
  return `Form ${options.trend}, ${options.fixtureText}, Preis ${options.priceVsForm} → ${options.badge}`;
}

export function priceVsForm(form: number | null, price: number): "hinkt" | "passt" | "voraus" {
  if (form == null) return "passt";
  const divergence = form - price;
  if (divergence >= 15) return "hinkt";
  if (divergence <= -15) return "voraus";
  return "passt";
}

export function fixtureModifier(opponentPercentiles: number[]): FixtureModifier {
  if (opponentPercentiles.length === 0) return 0;
  const mean = opponentPercentiles.reduce((sum, value) => sum + value, 0) / opponentPercentiles.length;
  if (mean < 100 / 3) return 1;
  if (mean > 200 / 3) return -1;
  return 0;
}

export function fixtureText(modifier: FixtureModifier, percentileCount: number): FixtureText {
  if (percentileCount === 0) return "Gegner unbekannt";
  if (modifier === 1) return "günstige Gegner";
  if (modifier === -1) return "schwere Gegner";
  return "gemischte Gegner";
}
