export function formatMarketValue(value: number): string {
  if (value >= 1_000_000) {
    const mio = value / 1_000_000;
    const digits = Number.isInteger(mio) ? 0 : 1;
    return `${mio.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: 1 })} Mio`;
  }
  return `${value.toLocaleString("de-DE")} €`;
}

export function squadValue(marketValues: number[]): number {
  return marketValues.reduce((sum, value) => sum + value, 0);
}

export function budgetRemaining(budget: number | null | undefined, value: number): number | null {
  if (budget == null) return null;
  return budget - value;
}
