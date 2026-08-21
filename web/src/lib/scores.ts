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

export function priceScore(value: number, peerValues: number[]): number {
  if (peerValues.length <= 1) return 50;
  const sorted = [...peerValues].sort((a, b) => a - b);
  const index = sorted.findIndex((peer) => peer >= value);
  const rank = index === -1 ? sorted.length - 1 : index;
  return (rank / (sorted.length - 1)) * 100;
}

export type RadarBadge = "Kaufen" | "Verkaufen" | "Halten" | "Beobachten" | "Nicht verfügbar";

export function radarBadge(options: {
  inSquad: boolean;
  form: number | null;
  price: number;
  gate: "block" | "warn" | "ok";
}): RadarBadge | "hidden" {
  if (options.gate === "block") return "Nicht verfügbar";
  if (options.form == null) return options.inSquad ? "Beobachten" : "hidden";
  const divergence = options.form - options.price;
  if (options.inSquad) {
    if (divergence <= -15) return "Verkaufen";
    if (divergence > 5) return "Halten";
    return "Beobachten";
  }
  if (divergence >= 15) return "Kaufen";
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
  badge: RadarBadge;
  priceVsForm: "hinkt" | "passt" | "voraus";
}): string {
  return `Form ${options.trend}, Gegner ohne Mapping, Preis ${options.priceVsForm} → ${options.badge}`;
}

export function priceVsForm(form: number | null, price: number): "hinkt" | "passt" | "voraus" {
  if (form == null) return "passt";
  const divergence = form - price;
  if (divergence >= 15) return "hinkt";
  if (divergence <= -15) return "voraus";
  return "passt";
}
