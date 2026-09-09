export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

/** Deterministic 0–1 hash. Cheap and good enough for visual noise. */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
