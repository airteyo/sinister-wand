import { americanToDecimal, applyVig, decimalToAmerican, devig, type DevigMethod } from '../odds';
import type { Rng } from '../rng';
import type { SportConfig } from '../sports';
import { logit, sigmoid } from '../stats';
import type { MarketSnap } from '../types';
import { fairSpread, fairTotal, roundLine, spreadTriple, totalTriple, type GameDist } from './pricing';

/** Round a decimal price to the nearest 5-cent American increment, like a real board. */
export function nickel(decimal: number): number {
  const a = decimalToAmerican(decimal);
  let r = Math.round(a / 5) * 5;
  if (r > -100 && r < 100) r = r >= 0 ? 100 : -100;
  return americanToDecimal(r);
}

export interface BookStyle {
  name: string;
  vig: number;
  /** Logit-scale price noise vs. the sharp consensus. */
  noise: number;
  /** Chance of hanging a line half a point off consensus. */
  offLine: number;
  sharp?: boolean;
}

export const BOOKS: BookStyle[] = [
  { name: 'Sharp', vig: 0.022, noise: 0, offLine: 0, sharp: true },
  { name: 'Northline', vig: 0.045, noise: 0.035, offLine: 0.2 },
  { name: 'Apex', vig: 0.048, noise: 0.045, offLine: 0.25 },
  { name: 'Vault', vig: 0.052, noise: 0.05, offLine: 0.3 },
  { name: 'Summit', vig: 0.04, noise: 0.03, offLine: 0.15 },
];

function consensusLines(cfg: SportConfig, dist: GameDist) {
  let spread: number;
  if (cfg.fixedSpread) spread = dist.pHome >= 0.5 ? -cfg.fixedSpread : cfg.fixedSpread;
  else spread = roundLine(fairSpread(dist), 0.5);
  if (spread === 0 && !cfg.threeWay) spread = dist.pHome >= 0.5 ? -0.5 : 0.5;
  let total: number;
  if (cfg.scoreModel === 'count') {
    const f = fairTotal(dist);
    const a = Math.floor(f) - 0.5, b = Math.floor(f) + 0.5;
    total = Math.abs(totalTriple(dist, a).win - 0.5) < Math.abs(totalTriple(dist, b).win - 0.5) ? a : b;
  } else total = roundLine(fairTotal(dist), 0.5);
  return { spread, total };
}

const jitter = (p: number, rng: Rng | null, s: number) => (rng && s ? sigmoid(logit(p) + rng.normal(0, s)) : p);

/** Quote a full market (spread, total, moneyline) for a given belief distribution. */
export function quote(cfg: SportConfig, dist: GameDist, style: BookStyle, rng: Rng | null): MarketSnap {
  const base = consensusLines(cfg, dist);
  let spread = base.spread, total = base.total;
  if (rng && !cfg.fixedSpread && rng.next() < style.offLine) spread += rng.next() < 0.5 ? -0.5 : 0.5;
  if (rng && cfg.scoreModel === 'margin' && rng.next() < style.offLine) total += rng.next() < 0.5 ? -0.5 : 0.5;
  if (spread === 0 && !cfg.threeWay) spread = base.spread;

  const st = spreadTriple(dist, spread);
  const pS = jitter(st.win / Math.max(1e-9, st.win + st.loss), rng, style.noise);
  const tt = totalTriple(dist, total);
  const pT = jitter(tt.win / Math.max(1e-9, tt.win + tt.loss), rng, style.noise);

  let ml: number[];
  if (cfg.threeWay) {
    const h = jitter(dist.pHome, rng, style.noise), a = jitter(dist.pAway, rng, style.noise), d = dist.pDraw;
    const s = h + a + d;
    ml = applyVig([h / s, a / s, d / s], style.vig * 1.35).map(nickel);
  } else {
    const h = jitter(dist.pHome, rng, style.noise);
    ml = applyVig([h, 1 - h], style.vig).map(nickel);
  }
  return {
    spread,
    total,
    spreadPrice: applyVig([pS, 1 - pS], style.vig).map(nickel) as [number, number],
    totalPrice: applyVig([pT, 1 - pT], style.vig).map(nickel) as [number, number],
    ml,
  };
}

/** No-vig probabilities implied by a snapshot. */
export function fairFromSnap(s: MarketSnap, method: DevigMethod = 'shin') {
  return {
    spread: devig(s.spreadPrice, method === 'shin' ? 'multiplicative' : method) as [number, number],
    total: devig(s.totalPrice, method === 'shin' ? 'multiplicative' : method) as [number, number],
    ml: devig(s.ml, method),
  };
}
