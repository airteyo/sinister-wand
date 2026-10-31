/**
 * Odds math. Internally everything is decimal odds / probabilities;
 * American odds are a display format.
 */

export const americanToDecimal = (a: number) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
export function decimalToAmerican(d: number): number {
  if (d <= 1) return -100000;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}
export const probToDecimal = (p: number) => 1 / p;
export const probToAmerican = (p: number) => decimalToAmerican(1 / p);
export const americanToProb = (a: number) => 1 / americanToDecimal(a);

export function fmtAmerican(a: number): string {
  if (!isFinite(a)) return '—';
  return a > 0 ? `+${a}` : `${a}`;
}

export function fmtLine(x: number, signed = true): string {
  if (x === 0) return signed ? 'PK' : '0';
  const s = Number.isInteger(x) ? x.toFixed(0) : x.toFixed(1);
  return signed && x > 0 ? `+${s}` : s;
}

/** Bookmaker overround (sum of implied probabilities − 1). */
export const overround = (decimals: number[]) => decimals.reduce((a, d) => a + 1 / d, 0) - 1;

export type DevigMethod = 'multiplicative' | 'additive' | 'power' | 'shin';

/** Remove the vig from a set of mutually exclusive prices. Returns fair probabilities summing to 1. */
export function devig(decimals: number[], method: DevigMethod = 'shin'): number[] {
  const imp = decimals.map((d) => 1 / d);
  const booksum = imp.reduce((a, b) => a + b, 0);
  const n = imp.length;
  switch (method) {
    case 'multiplicative':
      return imp.map((p) => p / booksum);
    case 'additive':
      return imp.map((p) => p - (booksum - 1) / n);
    case 'power': {
      // find k with Σ p_i^k = 1
      let lo = 1, hi = 3;
      for (let i = 0; i < 60; i++) {
        const k = (lo + hi) / 2;
        const s = imp.reduce((a, p) => a + Math.pow(p, k), 0);
        if (s > 1) lo = k; else hi = k;
      }
      const k = (lo + hi) / 2;
      return imp.map((p) => Math.pow(p, k));
    }
    case 'shin': {
      // Shin (1993): solve for insider fraction z so fair probs sum to 1
      const f = (z: number) => imp.map((p) => (Math.sqrt(z * z + 4 * (1 - z) * (p * p) / booksum) - z) / (2 * (1 - z)));
      let lo = 0, hi = 0.4;
      for (let i = 0; i < 80; i++) {
        const z = (lo + hi) / 2;
        const s = f(z).reduce((a, b) => a + b, 0);
        if (s > 1) lo = z; else hi = z;
      }
      return f((lo + hi) / 2);
    }
  }
}

/** Apply a margin to fair probabilities (multiplicative), returning decimal odds. */
export function applyVig(probs: number[], margin: number): number[] {
  return probs.map((p) => 1 / (p * (1 + margin)));
}

/** Expected value per unit staked with win/push/loss outcome probabilities. */
export function expectedValue(pWin: number, decimal: number, pPush = 0): number {
  const pLoss = 1 - pWin - pPush;
  return pWin * (decimal - 1) - pLoss;
}

/**
 * Full Kelly fraction with pushes: maximise p_w·log(1+bf) + p_l·log(1−f).
 * f* = (p_w·b − p_l) / (b·(p_w + p_l))
 */
export function kelly(pWin: number, decimal: number, pPush = 0): number {
  const b = decimal - 1;
  const pLoss = 1 - pWin - pPush;
  if (b <= 0) return 0;
  const f = (pWin * b - pLoss) / (b * (pWin + pLoss));
  return Math.max(0, f);
}

/** Closing line value: how much better your price was than the no-vig close, as a % edge. */
export function clv(betDecimal: number, closeFairProb: number): number {
  return betDecimal * closeFairProb - 1;
}

export interface ParlayLeg { decimal: number; prob: number }

/** Parlay price/probability; `corr` is an average pairwise correlation used as a crude joint adjustment. */
export function parlay(legs: ParlayLeg[], corr = 0) {
  const decimal = legs.reduce((a, l) => a * l.decimal, 1);
  let prob = legs.reduce((a, l) => a * l.prob, 1);
  if (corr && legs.length > 1) {
    // pairwise Gaussian-copula-ish adjustment: P(A∩B) ≈ pApB + ρ·sqrt(pA(1−pA)pB(1−pB))
    let adj = 1;
    for (let i = 0; i < legs.length; i++)
      for (let j = i + 1; j < legs.length; j++) {
        const a = legs[i].prob, b = legs[j].prob;
        adj *= (a * b + corr * Math.sqrt(a * (1 - a) * b * (1 - b))) / (a * b);
      }
    prob = Math.min(1, prob * adj);
  }
  return { decimal, american: decimalToAmerican(decimal), prob, ev: prob * decimal - 1 };
}

/** Stake on the opposite side to lock in a guaranteed result. */
export function hedge(stake: number, origDecimal: number, hedgeDecimal: number) {
  const payout = stake * origDecimal;
  const hedgeStake = payout / hedgeDecimal;
  return { hedgeStake, lockedProfit: payout - stake - hedgeStake };
}

/** Find middle/arb: two sides with combined implied < 1. */
export function arbitrage(d1: number, d2: number) {
  const s = 1 / d1 + 1 / d2;
  return { isArb: s < 1, margin: 1 - s, stake1: 1 / d1 / s, stake2: 1 / d2 / s };
}
