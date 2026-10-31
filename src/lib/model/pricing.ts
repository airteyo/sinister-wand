import { clamp, negbinPmf, normCdf } from '../stats';
import type { SportConfig } from '../sports';

export interface Pmf { values: number[]; probs: number[] }

/** Complete final-score distribution for one game, after overtime/extra innings are resolved. */
export interface GameDist {
  muHome: number;
  muAway: number;
  /** Final margin (home − away) distribution. */
  margin: Pmf;
  /** Final total distribution. */
  total: Pmf;
  pHome: number;
  pAway: number;
  /** Only non-zero for three-way markets (soccer). */
  pDraw: number;
  /** Chance regulation ends level (goes to OT / extras / is a draw). */
  pRegTie: number;
  /** Exact-score matrix for count sports (home goals × away goals), regulation only. */
  scoreGrid?: number[][];
}

export interface Triple { win: number; push: number; loss: number }

const sumTo = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

function normalize(p: Pmf): Pmf {
  const s = sumTo(p.probs);
  return { values: p.values, probs: p.probs.map((x) => x / s) };
}

const pmfMean = (p: Pmf) => p.values.reduce((a, v, i) => a + v * p.probs[i], 0);

/** Discretised normal on integers, optionally reshaped by key-number weights, with location solved so the mean is preserved. */
export function discreteMargin(mu: number, sd: number, keyNumbers?: Record<number, number>): Pmf {
  const lo = Math.floor(mu - 5.5 * sd), hi = Math.ceil(mu + 5.5 * sd);
  const build = (loc: number): Pmf => {
    const values: number[] = [], probs: number[] = [];
    for (let m = lo; m <= hi; m++) {
      const base = normCdf(m + 0.5, loc, sd) - normCdf(m - 0.5, loc, sd);
      const w = keyNumbers ? keyNumbers[Math.abs(m)] ?? 1 : 1;
      values.push(m);
      probs.push(base * w);
    }
    return normalize({ values, probs });
  };
  if (!keyNumbers) return build(mu);
  // fixed-point iteration: mean(loc) has slope ≈ 1, so this converges in a handful of steps
  let loc = mu, pmf = build(loc);
  for (let i = 0; i < 5; i++) {
    const err = mu - pmfMean(pmf);
    if (Math.abs(err) < 1e-3) break;
    loc += err;
    pmf = build(loc);
  }
  return pmf;
}

function discreteTotal(mu: number, sd: number): Pmf {
  const lo = Math.max(0, Math.floor(mu - 5.5 * sd)), hi = Math.ceil(mu + 5.5 * sd);
  const values: number[] = [], probs: number[] = [];
  for (let t = lo; t <= hi; t++) {
    values.push(t);
    probs.push(normCdf(t + 0.5, mu, sd) - normCdf(t - 0.5, mu, sd));
  }
  return normalize({ values, probs });
}

/** Resolve regulation ties into a winner by `otMargin`, home taking the extra period with probability q. */
function resolveTies(margin: Pmf, q: number, otMargin: number): { margin: Pmf; pTie: number } {
  const map = new Map<number, number>();
  let pTie = 0;
  margin.values.forEach((v, i) => {
    const p = margin.probs[i];
    if (v === 0) {
      pTie = p;
      map.set(otMargin, (map.get(otMargin) ?? 0) + p * q);
      map.set(-otMargin, (map.get(-otMargin) ?? 0) + p * (1 - q));
    } else map.set(v, (map.get(v) ?? 0) + p);
  });
  const values = [...map.keys()].sort((a, b) => a - b);
  return { margin: { values, probs: values.map((v) => map.get(v)!) }, pTie };
}

function shiftTotalForTies(total: Pmf, pTie: number, extra: number): Pmf {
  if (!pTie || !extra) return total;
  // approximation: ties are concentrated in lower-scoring games; spread extra mass evenly
  const map = new Map<number, number>();
  total.values.forEach((v, i) => {
    const p = total.probs[i];
    map.set(v, (map.get(v) ?? 0) + p * (1 - pTie));
    map.set(v + extra, (map.get(v + extra) ?? 0) + p * pTie);
  });
  const values = [...map.keys()].sort((a, b) => a - b);
  return { values, probs: values.map((v) => map.get(v)!) };
}

export interface PriceOpts {
  /** Extra variance on the margin from rating uncertainty. */
  extraMarginVar?: number;
}

export function priceGame(cfg: SportConfig, muHome: number, muAway: number, opts: PriceOpts = {}): GameDist {
  muHome = Math.max(0.05, muHome);
  muAway = Math.max(0.05, muAway);
  if (cfg.scoreModel === 'margin') {
    const sdM = Math.sqrt(cfg.marginSd ** 2 + (opts.extraMarginVar ?? 0));
    const raw = discreteMargin(muHome - muAway, sdM, cfg.keyNumbers);
    // overtime: the better team is a modest favourite; regulation ties are mostly coin flips
    const q = clamp(0.5 + (muHome - muAway) / (6 * sdM), 0.3, 0.7);
    const { margin, pTie } = resolveTies(raw, q, cfg.otMargin);
    const total = shiftTotalForTies(discreteTotal(muHome + muAway, cfg.totalSd), pTie, cfg.otMargin * 2);
    let pHome = 0;
    margin.values.forEach((v, i) => { if (v > 0) pHome += margin.probs[i]; });
    return { muHome, muAway, margin, total, pHome, pAway: 1 - pHome, pDraw: 0, pRegTie: pTie };
  }

  // count sports: (negative-)binomial marginals joined with a Dixon–Coles low-score correction
  const K = Math.ceil(Math.max(muHome, muAway) * 3 + 10);
  const ph: number[] = [], pa: number[] = [];
  for (let k = 0; k <= K; k++) {
    ph.push(negbinPmf(k, muHome, cfg.dispersion));
    pa.push(negbinPmf(k, muAway, cfg.dispersion));
  }
  const rho = cfg.rho;
  const tau = (h: number, a: number) => {
    if (h === 0 && a === 0) return 1 - muHome * muAway * rho;
    if (h === 0 && a === 1) return 1 + muHome * rho;
    if (h === 1 && a === 0) return 1 + muAway * rho;
    if (h === 1 && a === 1) return 1 - rho;
    return 1;
  };
  const grid: number[][] = [];
  const mArr = new Float64Array(2 * K + 1), tArr = new Float64Array(2 * K + 1);
  let s = 0;
  for (let h = 0; h <= K; h++) {
    const row: number[] = new Array(K + 1);
    for (let a = 0; a <= K; a++) {
      const p = h < 2 && a < 2 ? Math.max(0, ph[h] * pa[a] * tau(h, a)) : ph[h] * pa[a];
      row[a] = p;
      s += p;
    }
    grid.push(row);
  }
  for (let h = 0; h <= K; h++)
    for (let a = 0; a <= K; a++) {
      const p = (grid[h][a] /= s);
      mArr[h - a + K] += p;
      tArr[h + a] += p;
    }
  const mv: number[] = [], mp: number[] = [], tv: number[] = [], tp: number[] = [];
  for (let i = 0; i < mArr.length; i++) {
    if (mArr[i] > 1e-12) { mv.push(i - K); mp.push(mArr[i]); }
    if (tArr[i] > 1e-12) { tv.push(i); tp.push(tArr[i]); }
  }
  const regMargin: Pmf = { values: mv, probs: mp };
  let total: Pmf = { values: tv, probs: tp };
  const pRegTie = mArr[K];

  if (cfg.threeWay) {
    let pHome = 0, pAway = 0;
    mv.forEach((v, i) => { if (v > 0) pHome += mp[i]; else if (v < 0) pAway += mp[i]; });
    return { muHome, muAway, margin: regMargin, total, pHome, pAway, pDraw: pRegTie, pRegTie, scoreGrid: grid };
  }
  const q = clamp(muHome / (muHome + muAway), 0.3, 0.7);
  const { margin } = resolveTies(regMargin, q, cfg.otMargin);
  total = shiftTotalForTies(total, pRegTie, cfg.otMargin);
  let pHome = 0;
  margin.values.forEach((v, i) => { if (v > 0) pHome += margin.probs[i]; });
  return { muHome, muAway, margin, total, pHome, pAway: 1 - pHome, pDraw: 0, pRegTie, scoreGrid: grid };
}

/** Probability the home side covers `homeLine` (e.g. −3.5). Quarter lines are split into two half-stakes. */
export function spreadTriple(dist: GameDist, homeLine: number): Triple {
  if (Math.abs((homeLine * 4) % 2) === 1) {
    const a = spreadTriple(dist, homeLine - 0.25), b = spreadTriple(dist, homeLine + 0.25);
    return { win: (a.win + b.win) / 2, push: (a.push + b.push) / 2, loss: (a.loss + b.loss) / 2 };
  }
  let win = 0, push = 0;
  dist.margin.values.forEach((m, i) => {
    const x = m + homeLine;
    if (Math.abs(x) < 1e-9) push += dist.margin.probs[i];
    else if (x > 0) win += dist.margin.probs[i];
  });
  return { win, push, loss: Math.max(0, 1 - win - push) };
}

/** Over/push/under at `line`. */
export function totalTriple(dist: GameDist, line: number): Triple {
  let win = 0, push = 0;
  dist.total.values.forEach((t, i) => {
    if (Math.abs(t - line) < 1e-9) push += dist.total.probs[i];
    else if (t > line) win += dist.total.probs[i];
  });
  return { win, push, loss: Math.max(0, 1 - win - push) };
}

/** Continuous median of a discrete pmf (linear interpolation across the half-integer boundaries). */
function pmfMedian(p: Pmf): number {
  let c = 0;
  for (let i = 0; i < p.values.length; i++) {
    const next = c + p.probs[i];
    if (next >= 0.5) {
      const frac = p.probs[i] ? (0.5 - c) / p.probs[i] : 0.5;
      return p.values[i] - 0.5 + frac;
    }
    c = next;
  }
  return p.values[p.values.length - 1];
}

/** Fair home handicap: the line where home cover ≈ 50%. */
export const fairSpread = (dist: GameDist) => -pmfMedian(dist.margin);
export const fairTotal = (dist: GameDist) => pmfMedian(dist.total);

/** Round to the nearest bookable line on a step grid, preferring half-points for two-way markets. */
export function roundLine(x: number, step = 0.5): number {
  return Math.round(x / step) * step;
}
