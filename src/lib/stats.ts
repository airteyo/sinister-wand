export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Abramowitz–Stegun 7.1.26 erf, |error| < 1.5e-7. */
export function erf(x: number): number {
  const s = Math.sign(x);
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

export const normCdf = (x: number, mu = 0, sd = 1) => 0.5 * (1 + erf((x - mu) / (sd * Math.SQRT2)));
export const normPdf = (x: number, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

const LOG_FACT: number[] = [0];
export function logFactorial(n: number): number {
  for (let i = LOG_FACT.length; i <= n; i++) LOG_FACT[i] = LOG_FACT[i - 1] + Math.log(i);
  return LOG_FACT[n];
}

export function lgamma(x: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(lambda) - lambda - logFactorial(k));
}

/** Negative binomial pmf parameterised by mean and dispersion r (variance = μ + μ²/r). */
export function negbinPmf(k: number, mean: number, r: number): number {
  if (!isFinite(r)) return poissonPmf(k, mean);
  const p = r / (r + mean);
  return Math.exp(lgamma(k + r) - lgamma(r) - logFactorial(k) + r * Math.log(p) + k * Math.log(mean / (r + mean)));
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function brier(ps: number[], ys: number[]): number {
  return mean(ps.map((p, i) => (p - ys[i]) ** 2));
}

export function logLoss(ps: number[], ys: number[]): number {
  return mean(ps.map((p, i) => {
    const q = clamp(p, 1e-6, 1 - 1e-6);
    return -(ys[i] * Math.log(q) + (1 - ys[i]) * Math.log(1 - q));
  }));
}

export interface CalBin { lo: number; hi: number; predicted: number; observed: number; n: number }

export function calibration(ps: number[], ys: number[], bins = 10): CalBin[] {
  const out: CalBin[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins, hi = (b + 1) / bins;
    const idx = ps.map((p, i) => [p, i] as const).filter(([p]) => p >= lo && (p < hi || (b === bins - 1 && p <= hi)));
    if (!idx.length) continue;
    out.push({ lo, hi, n: idx.length, predicted: mean(idx.map(([p]) => p)), observed: mean(idx.map(([, i]) => ys[i])) });
  }
  return out;
}

export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity, dd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e);
    if (peak > 0) dd = Math.max(dd, (peak - e) / peak);
  }
  return dd;
}
