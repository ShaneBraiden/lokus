/** Server time source. Every authoritative timestamp (event server_ts, clocks, expiries) comes from here. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Controllable clock for tests: persona timings (minutes after opening DM-220, the W2 clock) are replayed exactly. */
export class FakeClock implements Clock {
  private t: number;
  constructor(start: Date | number = Date.UTC(2026, 9, 20, 3, 0)) {
    this.t = typeof start === 'number' ? start : start.getTime();
  }
  now(): Date {
    return new Date(this.t);
  }
  set(t: Date | number): void {
    this.t = typeof t === 'number' ? t : t.getTime();
  }
  advance(ms: number): void {
    this.t += ms;
  }
  advanceMinutes(minutes: number): void {
    this.t += minutes * 60_000;
  }
}
