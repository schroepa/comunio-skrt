import { availabilityGate, robustMinutes, type AvailabilityKind } from "./availability";
import { formScore } from "./scores";

export type Venue = "home" | "away" | "unknown";

export function expectedPoints(input: {
  notesNewestFirst: number[];
  status: AvailabilityKind | null;
  lastThreeMinutes: number[];
  venue: Venue;
}): number {
  const form = formScore(input.notesNewestFirst);
  const base = form == null ? 3 : 1 + (form / 100) * 7;
  const gate = availabilityGate(input.status);
  if (gate === "block") return 0;
  let value = base;
  if (gate === "warn") value *= 0.6;
  if (robustMinutes(input.lastThreeMinutes)) value *= 0.7;
  if (input.venue === "home") value *= 1.05;
  if (input.venue === "away") value *= 0.95;
  return Math.round(Math.min(12, Math.max(0, value)) * 10) / 10;
}
