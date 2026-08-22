import { budgetRemaining, squadValue } from "./money";
import { getNextMatchday, type FixtureRecord } from "./fixtures";

export type OfficeStatus = {
  spieltag: number | null;
  deadlineIso: string | null;
  seasonOver: boolean;
  remaining: number | null;
  value: number;
  squadCount: number;
};

export function officeStatus(input: {
  now: Date;
  fixtures: FixtureRecord[];
  marketValues: number[];
  budget: number | null | undefined;
  squadCount: number;
}): OfficeStatus {
  const matchday = input.fixtures.length > 0 ? getNextMatchday(input.fixtures, input.now) : null;
  const value = squadValue(input.marketValues);
  return {
    spieltag: matchday?.spieltag ?? null,
    deadlineIso: matchday?.deadline && !matchday.seasonOver ? matchday.deadline.toISOString() : null,
    seasonOver: Boolean(matchday?.seasonOver),
    remaining: budgetRemaining(input.budget, value),
    value,
    squadCount: input.squadCount,
  };
}
