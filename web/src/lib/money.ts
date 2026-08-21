export function squadValue(marketValues: number[]): number {
  return marketValues.reduce((sum, value) => sum + value, 0);
}

export function budgetRemaining(budget: number | null | undefined, value: number): number | null {
  if (budget == null) return null;
  return budget - value;
}
