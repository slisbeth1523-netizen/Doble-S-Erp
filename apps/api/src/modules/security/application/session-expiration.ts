const timeUnitToMilliseconds: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
};

export function getSessionExpiration(expiresIn: string) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());

  if (!match) {
    return new Date(Date.now() + 3_600_000);
  }

  const [, amount, unit] = match;
  return new Date(Date.now() + Number(amount) * timeUnitToMilliseconds[unit]);
}
