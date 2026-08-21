export type FixtureRecord = {
  spieltag: number;
  heim_verein: string;
  auswaerts_verein: string;
  datum: string;
};

export type NextMatchday = {
  spieltag: number;
  fixtures: FixtureRecord[];
  deadline: Date | null;
  seasonOver: boolean;
};

function kickoff(fixture: FixtureRecord): number {
  return new Date(fixture.datum).getTime();
}

function byKickoff(a: FixtureRecord, b: FixtureRecord): number {
  return kickoff(a) - kickoff(b);
}

export function getNextMatchday(fixtures: FixtureRecord[], now: Date): NextMatchday | null {
  if (fixtures.length === 0) return null;

  const groups = new Map<number, FixtureRecord[]>();
  for (const fixture of fixtures) {
    const list = groups.get(fixture.spieltag) ?? [];
    list.push(fixture);
    groups.set(fixture.spieltag, list);
  }

  const tags = [...groups.keys()].sort((a, b) => a - b);
  const nowMs = now.getTime();
  const upcoming = tags.find((tag) => (groups.get(tag) ?? []).some((f) => kickoff(f) >= nowMs));

  if (upcoming === undefined) {
    const last = tags[tags.length - 1];
    return {
      spieltag: last,
      fixtures: [...(groups.get(last) ?? [])].sort(byKickoff),
      deadline: null,
      seasonOver: true,
    };
  }

  const round = [...(groups.get(upcoming) ?? [])].sort(byKickoff);
  const remaining = round.filter((f) => kickoff(f) >= nowMs);
  return {
    spieltag: upcoming,
    fixtures: round,
    deadline: remaining[0] ? new Date(remaining[0].datum) : null,
    seasonOver: false,
  };
}

export function nextMatchdayFixtures(fixtures: FixtureRecord[], now: Date): FixtureRecord[] {
  return getNextMatchday(fixtures, now)?.fixtures ?? [];
}

export function deriveDeadline(fixtures: FixtureRecord[], now: Date): Date | null {
  return getNextMatchday(fixtures, now)?.deadline ?? null;
}
