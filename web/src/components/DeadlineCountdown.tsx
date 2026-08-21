import { useEffect, useState } from "react";
import { formatDeadlineRemaining } from "../lib/countdown";

type Props = { deadlineIso: string };

export default function DeadlineCountdown({ deadlineIso }: Props) {
  const deadline = new Date(deadlineIso);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="font-[Syne] text-2xl tabular-nums">{formatDeadlineRemaining(deadline, now)}</p>
  );
}
