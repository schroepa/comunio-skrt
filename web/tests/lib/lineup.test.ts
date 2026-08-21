import { describe, expect, it } from "vitest";
import { pickLineup, type LineupCandidate } from "../../src/lib/lineup";

function player(id: number, position: LineupCandidate["position"], points: number, blocked = false): LineupCandidate {
  return { id, position, points, blocked };
}

describe("pickLineup", () => {
  it("picks eleven with one keeper", () => {
    const squad: LineupCandidate[] = [
      player(1, "Torwart", 5),
      player(2, "Torwart", 4),
      ...[3, 4, 5, 6].map((id) => player(id, "Abwehr", 6)),
      ...[7, 8, 9, 10].map((id) => player(id, "Mittelfeld", 7)),
      ...[11, 12].map((id) => player(id, "Sturm", 8)),
    ];
    const result = pickLineup(squad);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.eleven).toHaveLength(11);
    expect(result.eleven.filter((row) => row.position === "Torwart")).toHaveLength(1);
    expect(result.eleven.some((row) => row.id === 1)).toBe(true);
  });

  it("excludes blocked keepers", () => {
    const squad: LineupCandidate[] = [
      player(1, "Torwart", 9, true),
      ...[2, 3, 4].map((id) => player(id, "Abwehr", 5)),
      ...[5, 6, 7].map((id) => player(id, "Mittelfeld", 5)),
      player(8, "Sturm", 5),
    ];
    expect(pickLineup(squad)).toEqual({ ok: false, reason: "no_goalkeeper" });
  });
});
