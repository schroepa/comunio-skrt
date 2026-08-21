export type ParsedFixture = {
  spieltag: number;
  heim_verein: string;
  auswaerts_verein: string;
  datum: string;
};

type OpenLigaMatch = {
  matchDateTime?: unknown;
  group?: { groupOrderID?: unknown };
  team1?: { teamName?: unknown };
  team2?: { teamName?: unknown };
};

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`OpenLigaDB match missing ${label}`);
  }
  return value;
}

export function parseMatches(raw: unknown): ParsedFixture[] {
  if (!Array.isArray(raw)) {
    throw new Error("OpenLigaDB payload is not an array");
  }
  return raw.map((item, index) => {
    const match = item as OpenLigaMatch;
    const spieltag = match.group?.groupOrderID;
    if (typeof spieltag !== "number") {
      throw new Error(`OpenLigaDB match[${index}] missing group.groupOrderID`);
    }
    return {
      spieltag,
      heim_verein: requiredString(match.team1?.teamName, "teamName"),
      auswaerts_verein: requiredString(match.team2?.teamName, "teamName"),
      datum: requiredString(match.matchDateTime, "matchDateTime"),
    };
  });
}
