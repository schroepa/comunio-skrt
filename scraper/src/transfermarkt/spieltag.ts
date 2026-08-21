export function nextSpieltag(
  fixtures: Array<{ spieltag: number; datum: string }>,
  now: Date,
): number | null {
  if (fixtures.length === 0) return null;

  const groups = new Map<number, string[]>();
  for (const fixture of fixtures) {
    const list = groups.get(fixture.spieltag) ?? [];
    list.push(fixture.datum);
    groups.set(fixture.spieltag, list);
  }

  const tags = [...groups.keys()].sort((a, b) => a - b);
  const nowMs = now.getTime();
  const upcoming = tags.find((tag) =>
    (groups.get(tag) ?? []).some((datum) => new Date(datum).getTime() >= nowMs),
  );

  return upcoming ?? null;
}
