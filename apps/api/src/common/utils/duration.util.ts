const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

// Parses short duration strings ("15m", "7d") into seconds, matching the
// format used by JWT_ACCESS_EXPIRES_IN so the same config value can drive
// both jsonwebtoken's `expiresIn` option and the numeric value returned to clients.
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${value}" (expected e.g. "15m", "7d")`);
  }
  const [, amount, unit] = match;
  return parseInt(amount, 10) * UNIT_SECONDS[unit];
}
