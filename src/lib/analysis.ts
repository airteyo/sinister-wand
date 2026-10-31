import { expectedValue, kelly, type DevigMethod } from './odds';
import { fairFromSnap } from './model/market';
import { priceGame, spreadTriple, totalTriple, type GameDist, type Triple } from './model/pricing';
import type { SportConfig } from './sports';
import { clamp, logit, sigmoid } from './stats';
import type { Game, MarketSnap, Prediction } from './types';

export type MarketType = 'ml' | 'spread' | 'total';
export type Side = 'home' | 'away' | 'draw' | 'over' | 'under';

export interface Evaluation {
  gameId: string;
  market: MarketType;
  side: Side;
  line: number | null;
  book: string;
  decimal: number;
  /** Model-only outcome probabilities. */
  model: Triple;
  /** Market (sharp, no-vig) outcome probabilities at this line. */
  market_: Triple;
  /** Blended probabilities used for decisions. */
  blend: Triple;
  ev: number;
  kelly: number;
  /** Win probability needed to break even at this price (ignoring pushes). */
  breakeven: number;
}

export function distFor(cfg: SportConfig, p: Prediction): GameDist {
  return priceGame(cfg, p.muHome, p.muAway, { extraMarginVar: cfg.scoreModel === 'margin' ? p.marginVar : 0 });
}

const blendProb = (pm: number, pk: number, w: number) => {
  const a = clamp(pm, 1e-4, 1 - 1e-4), b = clamp(pk, 1e-4, 1 - 1e-4);
  return sigmoid(w * logit(a) + (1 - w) * logit(b));
};

/** Blend two win/push/loss triples: blend the conditional win probability, keep the model's push mass. */
function blendTriple(model: Triple, mkt: Triple, w: number): Triple {
  const cm = model.win / Math.max(1e-9, model.win + model.loss);
  const ck = mkt.win / Math.max(1e-9, mkt.win + mkt.loss);
  const c = blendProb(cm, ck, w);
  const nonPush = 1 - model.push;
  return { win: c * nonPush, push: model.push, loss: (1 - c) * nonPush };
}

const flip = (t: Triple): Triple => ({ win: t.loss, push: t.push, loss: t.win });

/**
 * Market probability at an arbitrary line, anchored to the sharp book's no-vig price at its own line
 * and shifted by the model's own probability mass between the two lines (half-point value).
 */
function marketAtLine(model: (l: number) => Triple, sharpLine: number, sharpFairWin: number, line: number): Triple {
  const atSharp = model(sharpLine), atLine = model(line);
  const condSharp = atSharp.win / Math.max(1e-9, atSharp.win + atSharp.loss);
  const condLine = atLine.win / Math.max(1e-9, atLine.win + atLine.loss);
  const c = clamp(sharpFairWin + (condLine - condSharp), 0.001, 0.999);
  const nonPush = 1 - atLine.push;
  return { win: c * nonPush, push: atLine.push, loss: (1 - c) * nonPush };
}

export interface EvalOpts {
  weight: number;
  devig: DevigMethod;
  /** Which snapshot to evaluate: 'current' for live boards, 'open'/'close' for backtests. */
  snap: 'open' | 'current' | 'close';
}

const snapOf = (b: Game['books'][number], s: EvalOpts['snap']): MarketSnap | undefined => (s === 'open' ? b.open : s === 'close' ? b.close : b.current);

export function evaluateGame(cfg: SportConfig, g: Game, dist: GameDist, opts: EvalOpts): Evaluation[] {
  const sharpBook = g.books.find((b) => b.book === 'Sharp') ?? g.books.find((b) => b.reference) ?? g.books[0];
  const sharp = sharpBook && snapOf(sharpBook, opts.snap);
  if (!sharp) return [];
  const fair = fairFromSnap(sharp, opts.devig);
  const out: Evaluation[] = [];
  const homeSpread = (l: number) => spreadTriple(dist, l);
  const over = (l: number) => totalTriple(dist, l);

  const push = (market: MarketType, side: Side, line: number | null, book: string, decimal: number, model: Triple, mkt: Triple, wOverride?: number) => {
    const blend = blendTriple(model, mkt, wOverride ?? opts.weight);
    out.push({
      gameId: g.id, market, side, line, book, decimal, model, market_: mkt, blend,
      ev: expectedValue(blend.win, decimal, blend.push),
      kelly: kelly(blend.win, decimal, blend.push),
      breakeven: 1 / decimal,
    });
  };

  // moneyline (fair model probs blended outcome-by-outcome, then renormalised)
  const mProbs = cfg.threeWay ? [dist.pHome, dist.pAway, dist.pDraw] : [dist.pHome, dist.pAway];
  const raw = mProbs.map((p, i) => blendProb(p, fair.ml[i], opts.weight));
  const s = raw.reduce((a, b) => a + b, 0);
  const blended = raw.map((p) => p / s);

  for (const b of g.books) {
    const q = snapOf(b, opts.snap);
    if (!q || b.reference) continue;
    const sides: Side[] = cfg.threeWay ? ['home', 'away', 'draw'] : ['home', 'away'];
    sides.forEach((side, i) => {
      if (!q.ml[i] || !isFinite(q.ml[i]) || !isFinite(fair.ml[i])) return;
      const model = { win: mProbs[i], push: 0, loss: 1 - mProbs[i] };
      const mkt = { win: fair.ml[i], push: 0, loss: 1 - fair.ml[i] };
      const bl = { win: blended[i], push: 0, loss: 1 - blended[i] };
      out.push({
        gameId: g.id, market: 'ml', side, line: null, book: b.book, decimal: q.ml[i], model, market_: mkt, blend: bl,
        ev: expectedValue(bl.win, q.ml[i]), kelly: kelly(bl.win, q.ml[i]), breakeven: 1 / q.ml[i],
      });
    });

    if (isFinite(q.spread) && isFinite(sharp.spread) && isFinite(q.spreadPrice[0])) {
    const hm = homeSpread(q.spread);
    const hk = marketAtLine(homeSpread, sharp.spread, fair.spread[0], q.spread);
    push('spread', 'home', q.spread, b.book, q.spreadPrice[0], hm, hk);
    push('spread', 'away', -q.spread, b.book, q.spreadPrice[1], flip(hm), flip(hk));
    }

    if (isFinite(q.total) && isFinite(sharp.total) && isFinite(q.totalPrice[0])) {
    const om = over(q.total);
    const ok = marketAtLine(over, sharp.total, fair.total[0], q.total);
    push('total', 'over', q.total, b.book, q.totalPrice[0], om, ok);
    push('total', 'under', q.total, b.book, q.totalPrice[1], flip(om), flip(ok));
    }
  }
  return out;
}

/** Best price per (market, side) across books. */
export function bestPrices(evals: Evaluation[]): Evaluation[] {
  const best = new Map<string, Evaluation>();
  for (const e of evals) {
    const k = `${e.market}:${e.side}`;
    const cur = best.get(k);
    if (!cur || e.ev > cur.ev) best.set(k, e);
  }
  return [...best.values()];
}

export function settle(market: MarketType, side: Side, line: number | null, r: { home: number; away: number }): 'W' | 'L' | 'P' {
  const m = r.home - r.away, t = r.home + r.away;
  if (market === 'ml') {
    if (side === 'draw') return m === 0 ? 'W' : 'L';
    if (m === 0) return 'L';
    return (side === 'home') === m > 0 ? 'W' : 'L';
  }
  if (market === 'spread') {
    const x = side === 'home' ? m + line! : -m + line!;
    return x > 0 ? 'W' : x < 0 ? 'L' : 'P';
  }
  const x = side === 'over' ? t - line! : line! - t;
  return x > 0 ? 'W' : x < 0 ? 'L' : 'P';
}

export function selectionLabel(g: Pick<Game, 'home' | 'away'>, market: MarketType, side: Side, line: number | null, short = true): string {
  const nm = (s: string) => (short ? s.split(' ').slice(-1)[0] : s);
  const fl = (x: number) => (x > 0 ? `+${x}` : x === 0 ? 'PK' : `${x}`);
  if (market === 'ml') return side === 'draw' ? 'Draw' : `${nm(side === 'home' ? g.home : g.away)} ML`;
  if (market === 'spread') return `${nm(side === 'home' ? g.home : g.away)} ${fl(line!)}`;
  return `${side === 'over' ? 'Over' : 'Under'} ${line}`;
}
