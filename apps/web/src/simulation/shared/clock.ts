import { useEffect, useState } from 'react';

/** Re-renders every `intervalMs` and returns the server-aligned current time in ms. */
export function useServerNow(serverOffset: number, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() + serverOffset);
  useEffect(() => {
    setNow(Date.now() + serverOffset);
    const t = setInterval(() => setNow(Date.now() + serverOffset), intervalMs);
    return () => clearInterval(t);
  }, [serverOffset, intervalMs]);
  return now;
}

/** h:mm:ss for elapsed time. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
