export type AvailabilityKind = "fit" | "fraglich" | "verletzt" | "gesperrt";

export function availabilityGate(status: AvailabilityKind | null | undefined): "block" | "warn" | "ok" {
  if (status === "verletzt" || status === "gesperrt") return "block";
  if (status === "fraglich") return "warn";
  return "ok";
}

export function robustMinutes(lastThree: number[], possible = 90): boolean {
  if (lastThree.length === 0) return false;
  const share = lastThree.reduce((sum, minutes) => sum + minutes, 0) / (3 * possible);
  return share < 0.5;
}
