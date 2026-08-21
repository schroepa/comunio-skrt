export function formatDeadlineRemaining(deadline: Date, now: Date): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "läuft";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) {
    const dayLabel = days === 1 ? "Tag" : "Tagen";
    return `in ${days} ${dayLabel}, ${hours} Std.`;
  }
  if (hours > 0) return `in ${hours} Std., ${mins} Min.`;
  return `in ${mins} Min.`;
}
