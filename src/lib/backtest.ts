import { bestPrices, distFor, evaluateGame, selectionLabel, settle, type Evaluation, type MarketType } from './analysis';
import { fairFromSnap } from './model/market';
import { spreadTriple, totalTriple, type GameDist } from './model/pricing';
import type { DevigMethod } from './odds';
import type { SportConfig } from './sports';
import { brier, calibration, logLoss, maxDrawdown, mean, sd, type CalBin } from './stats';
import type { Game, Prediction } from './types';

export interface BacktestConfig {
  timing: 'open' | 'close';
  minEdge: number;
  staking: 'kelly' | 'flat';
  kellyFraction: number;
  maxStakePct: number;
  flatPct: number;
  markets: Record<MarketType, boolean>;
  startBankroll: number;
  /** Skip bets until both teams have played this many games in the season. */
  minGames: number;
  minDecimal: number;
  maxDecimal: number;
  weight: number;
  devig: DevigMethod;
  /** Skip bets where model and market disagree by more than this (probability points): usually missing news, not edge. */
  maxDisagreement: number;
}

export const DEFAULT_BT: BacktestConfig = {
  timing: 'open', minEdge: 0.02, staking: 'kelly', kellyFraction: 0.25, maxStakePct: 0.03, flatPct: 0.01,
  markets: { ml: true, spread: true, total: true }, startBankroll: 10000, minGames: 3,
  minDecimal: 1.3, maxDecimal: 4.5, weight: 0.3, devig: 'shin', maxDisagreement: 0.08,
};

export interface BtBet {
  gameId: string;
  day: number;
  date: string;
  matchup: string;
  label: string;
  market: MarketType;
  book: string;
  decimal: number;
  pWin: number;
  ev: number;
  stake: number;
  pnl: number;
  result: 'W' | 'L' | 'P';
  clv: number;
}

export interface BacktestResult {
  bets: BtBet[];
  equity: { day: number; date: string; bankroll: number; clvAvg: number }[];
  summary: {
    n: number; won: number; lost: number; pushed: number; staked: number; profit: number;
    roi: number; growth: number; avgEdge: number; avgClv: number; beatClose: number; maxDd: number; sharpe: number; avgOdds: number;
  };
  byMarket: { market: MarketType; n: number; roi: number; profit: number; clv: number }[];
  calibration: { model: CalBin[]; market: CalBin[]; blend: CalBin[] };
  scores: { model: { brier: number; logloss: number }; market: { brier: number; logloss: number }; blend: { brier: number; logloss: number }; n: number };
  /** Mean absolute error of predicted margin vs actual, for model and closing market. */
  mae: { model: number; market: number };
}

export function closeFairWin(g: Game, e: Evaluation, dist: GameDist): number | null {
  const sharp = g.books.find((b) => b.book === 'Sharp')?.close;
  if (!sharp) return null;
  const fair = fairFromSnap(sharp, 'shin');
  if (e.market === 'ml') return fair.ml[e.side === 'home' ? 0 : e.side === 'away' ? 1 : 2];
  // move the closing fair price to the bet's line using the model's half-point values
  if (e.market === 'spread') {
    const homeLine = e.side === 'home' ? e.line! : -e.line!;
    const cond = (l: number) => { const t = spreadTriple(dist, l); return t.win / (t.win + t.loss); };
    const pHome = fair.spread[0] + cond(homeLine) - cond(sharp.spread);
    const t = spreadTriple(dist, homeLine);
    const c = e.side === 'home' ? pHome : 1 - pHome;
    return Math.min(0.999, Math.max(0.001, c)) * (1 - t.push) + t.push / e.decimal;
  }
  const cond = (l: number) => { const t = totalTriple(dist, l); return t.win / (t.win + t.loss); };
  const pOver = fair.total[0] + cond(e.line!) - cond(sharp.total);
  const t = totalTriple(dist, e.line!);
  const c = e.side === 'over' ? pOver : 1 - pOver;
  return Math.min(0.999, Math.max(0.001, c)) * (1 - t.push) + t.push / e.decimal;
}

/** Gap between model and market conditional win probability. */
export function disagreement(e: Evaluation) {
  const c = (t: { win: number; loss: number }) => t.win / Math.max(1e-9, t.win + t.loss);
  return Math.abs(c(e.model) - c(e.market_));
}

export function runBacktest(cfg: SportConfig, games: Game[], preds: Map<string, Prediction>, bt: BacktestConfig, seasons: number[]): BacktestResult {
  const played = games.filter((g) => g.result && seasons.includes(g.season)).sort((a, b) => a.day - b.day);
  let bankroll = bt.startBankroll;
  const bets: BtBet[] = [];
  const equity: BacktestResult['equity'] = [];
  const gp = new Map<string, number>();
  let curSeason = -1;
  const ps = { model: [] as number[], market: [] as number[], blend: [] as number[], y: [] as number[] };
  const errs = { model: [] as number[], market: [] as number[] };

  for (let i = 0; i < played.length; ) {
    const day = played[i].day;
    const slate: Game[] = [];
    while (i < played.length && played[i].day === day) slate.push(played[i++]);
    if (slate[0].season !== curSeason) { curSeason = slate[0].season; gp.clear(); }
    const dayStart = bankroll;
    const dayBets: BtBet[] = [];
    for (const g of slate) {
      const pred = preds.get(g.id);
      if (!pred || !g.result) continue;
      const dist = distFor(cfg, pred);
      const r = g.result;

      // forecasting scores (home win, decided games)
      const closeSharp = g.books.find((b) => b.book === 'Sharp')?.close;
      if (closeSharp) {
        const fair = fairFromSnap(closeSharp, 'shin');
        const evs = evaluateGame(cfg, g, dist, { weight: bt.weight, devig: bt.devig, snap: 'close' });
        const mlH = evs.find((e) => e.market === 'ml' && e.side === 'home');
        if (r.home !== r.away && mlH) {
          ps.model.push(cfg.threeWay ? dist.pHome / (dist.pHome + dist.pAway) : dist.pHome);
          ps.market.push(cfg.threeWay ? fair.ml[0] / (fair.ml[0] + fair.ml[1]) : fair.ml[0]);
          ps.blend.push(cfg.threeWay ? mlH.blend.win / (1 - (evs.find((e) => e.side === 'draw')?.blend.win ?? 0)) : mlH.blend.win);
          ps.y.push(r.home > r.away ? 1 : 0);
        }
        errs.model.push(Math.abs(r.home - r.away - (pred.muHome - pred.muAway)));
        if (!cfg.fixedSpread) errs.market.push(Math.abs(r.home - r.away + closeSharp.spread));
      }

      const ready = (gp.get(g.home) ?? 0) >= bt.minGames && (gp.get(g.away) ?? 0) >= bt.minGames;
      if (ready) {
        const evs = bestPrices(evaluateGame(cfg, g, dist, { weight: bt.weight, devig: bt.devig, snap: bt.timing }));
        for (const market of ['ml', 'spread', 'total'] as MarketType[]) {
          if (!bt.markets[market]) continue;
          const cands = evs.filter((e) => e.market === market && e.ev >= bt.minEdge && e.decimal >= bt.minDecimal && e.decimal <= bt.maxDecimal && (bt.maxDisagreement >= 0.3 || disagreement(e) <= bt.maxDisagreement));
          if (!cands.length) continue;
          const e = cands.reduce((a, b) => (b.ev > a.ev ? b : a));
          const frac = bt.staking === 'kelly' ? Math.min(bt.maxStakePct, e.kelly * bt.kellyFraction) : bt.flatPct;
          const stake = Math.round(dayStart * frac * 100) / 100;
          if (stake <= 0) continue;
          const res = settle(market, e.side, e.line, r);
          const pnl = res === 'W' ? stake * (e.decimal - 1) : res === 'L' ? -stake : 0;
          const cf = closeFairWin(g, e, dist);
          dayBets.push({
            gameId: g.id, day, date: g.date, matchup: `${g.away} @ ${g.home}`, label: selectionLabel(g, market, e.side, e.line),
            market, book: e.book, decimal: e.decimal, pWin: e.blend.win, ev: e.ev, stake, pnl, result: res,
            clv: cf === null ? 0 : e.decimal * cf - 1,
          });
        }
      }
      gp.set(g.home, (gp.get(g.home) ?? 0) + 1);
      gp.set(g.away, (gp.get(g.away) ?? 0) + 1);
    }
    for (const b of dayBets) bankroll += b.pnl;
    bets.push(...dayBets);
    equity.push({ day, date: slate[0].date, bankroll: Math.round(bankroll * 100) / 100, clvAvg: bets.length ? mean(bets.map((b) => b.clv)) : 0 });
  }

  const staked = bets.reduce((a, b) => a + b.stake, 0);
  const profit = bets.reduce((a, b) => a + b.pnl, 0);
  const dailyRet = equity.map((e, i) => (i ? e.bankroll / equity[i - 1].bankroll - 1 : 0)).filter((x) => x !== 0);
  const byMarket = (['ml', 'spread', 'total'] as MarketType[]).map((m) => {
    const bs = bets.filter((b) => b.market === m);
    const st = bs.reduce((a, b) => a + b.stake, 0);
    const pr = bs.reduce((a, b) => a + b.pnl, 0);
    return { market: m, n: bs.length, roi: st ? pr / st : 0, profit: pr, clv: bs.length ? mean(bs.map((b) => b.clv)) : 0 };
  });

  return {
    bets,
    equity,
    summary: {
      n: bets.length,
      won: bets.filter((b) => b.result === 'W').length,
      lost: bets.filter((b) => b.result === 'L').length,
      pushed: bets.filter((b) => b.result === 'P').length,
      staked, profit,
      roi: staked ? profit / staked : 0,
      growth: bankroll / bt.startBankroll - 1,
      avgEdge: mean(bets.map((b) => b.ev)),
      avgClv: mean(bets.map((b) => b.clv)),
      beatClose: bets.length ? bets.filter((b) => b.clv > 0).length / bets.length : 0,
      maxDd: maxDrawdown([bt.startBankroll, ...equity.map((e) => e.bankroll)]),
      sharpe: dailyRet.length > 1 && sd(dailyRet) ? (mean(dailyRet) / sd(dailyRet)) * Math.sqrt(252) : 0,
      avgOdds: mean(bets.map((b) => b.decimal)),
    },
    byMarket,
    calibration: { model: calibration(ps.model, ps.y), market: calibration(ps.market, ps.y), blend: calibration(ps.blend, ps.y) },
    scores: {
      model: { brier: brier(ps.model, ps.y), logloss: logLoss(ps.model, ps.y) },
      market: { brier: brier(ps.market, ps.y), logloss: logLoss(ps.market, ps.y) },
      blend: { brier: brier(ps.blend, ps.y), logloss: logLoss(ps.blend, ps.y) },
      n: ps.y.length,
    },
    mae: { model: mean(errs.model), market: errs.market.length ? mean(errs.market) : NaN },
  };
}
