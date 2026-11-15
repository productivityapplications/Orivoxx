export function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}
