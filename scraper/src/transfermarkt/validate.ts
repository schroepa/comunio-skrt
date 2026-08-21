import type { ParsedPlayer } from "./parse-kader.ts";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const DEFAULT_BOUNDS = { min: 360, max: 700 };

export function validateMarketPlayers(
  players: ParsedPlayer[],
  bounds: { min: number; max: number } = DEFAULT_BOUNDS,
): ValidationResult {
  const { min, max } = bounds;
  if (players.length < min || players.length > max) {
    return {
      ok: false,
      reason: `erwartete ${min}–${max} Spieler, erhalten ${players.length}`,
    };
  }
  return { ok: true };
}
