function now() {
  return new Date();
}

export const clock = {
  now,
  utcNow: now,
  today() {
    const current = now();
    return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
  },
  isoNow() {
    return now().toISOString();
  },
  addMilliseconds(milliseconds: number) {
    return new Date(now().getTime() + milliseconds);
  },
  parse(value: string) {
    return new Date(value);
  }
} as const;
