import { useEffect, useState } from "react";
import { formatDeadlineRemaining } from "../lib/countdown";

type Props = { deadlineIso: string; compact?: boolean };

export default function DeadlineCountdown({ deadlineIso, compact = false }: Props) {
  const deadline = new Date(deadlineIso);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const label = formatDeadlineRemaining(deadline, now);
  if (compact) {
    return <span className="font-semibold tabular-nums">{label}</span>;
  }
  return <p className="text-2xl font-semibold tabular-nums tracking-tight">{label}</p>;
}
