import { parseDurationToSeconds } from './duration.util';

describe('parseDurationToSeconds', () => {
  it('parses seconds, minutes, hours, days', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('2h')).toBe(7200);
    expect(parseDurationToSeconds('7d')).toBe(604800);
  });

  it('rejects malformed durations', () => {
    expect(() => parseDurationToSeconds('15')).toThrow();
    expect(() => parseDurationToSeconds('15 minutes')).toThrow();
    expect(() => parseDurationToSeconds('')).toThrow();
  });
});
