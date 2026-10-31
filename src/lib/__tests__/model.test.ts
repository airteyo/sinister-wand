import { describe, expect, it } from 'vitest';
import { priceGame, spreadTriple, totalTriple, fairSpread, fairTotal } from '../model/pricing';
import { RatingModel, DEFAULT_PARAMS } from '../model/ratings';
import { generateWorld, worldAt } from '../data/generate';
import { runBacktest, DEFAULT_BT } from '../backtest';
import { SPORTS } from '../sports';

describe('pricing', () => {
  it('NFL: a 3-point favourite wins ~59% and pushes -3 often (key number)', () => {
    const d = priceGame(SPORTS.nfl, 24, 21);
    expect(d.pHome).toBeGreaterThan(0.56);
    expect(d.pHome).toBeLessThan(0.62);
    const t = spreadTriple(d, -3);
    expect(t.push).toBeGreaterThan(0.07);
    expect(t.push).toBeLessThan(0.11);
    expect(Math.abs(fairSpread(d) + 3)).toBeLessThan(0.8);
    expect(Math.abs(fairTotal(d) - 45)).toBeLessThan(0.6);
    expect(d.pHome + d.pAway).toBeCloseTo(1, 6);
  });

  it('EPL: three-way probabilities sum to 1 and draws are realistic', () => {
    const d = priceGame(SPORTS.epl, 1.5, 1.2);
    expect(d.pHome + d.pAway + d.pDraw).toBeCloseTo(1, 6);
    expect(d.pDraw).toBeGreaterThan(0.22);
    expect(d.pDraw).toBeLessThan(0.3);
    const o = totalTriple(d, 2.5);
    expect(o.win).toBeGreaterThan(0.4);
    expect(o.win).toBeLessThan(0.6);
  });

  it('NHL: no ties after OT, puck line favourite -1.5 is plus money territory', () => {
    const d = priceGame(SPORTS.nhl, 3.3, 2.8);
    expect(d.pDraw).toBe(0);
    expect(d.margin.values.includes(0)).toBe(false);
    expect(spreadTriple(d, -1.5).win).toBeLessThan(0.45);
  });
});

describe('world + model', () => {
  it('generates a world, rates teams, and backtests', () => {
    const w = generateWorld('nfl', 1);
    const games = worldAt(w, w.initialToday);
    const m = new RatingModel(SPORTS.nfl, DEFAULT_PARAMS);
    const preds = m.run(games.filter((g) => g.day <= w.initialToday));
    expect(preds.size).toBeGreaterThan(500);
    const r = runBacktest(SPORTS.nfl, games, preds, DEFAULT_BT, [2025, 2026]);
    expect(r.summary.n).toBeGreaterThan(20);
    expect(r.scores.market.brier).toBeLessThan(0.25);
    // market should be sharper than (or about as sharp as) a results-only model
    expect(r.scores.market.brier).toBeLessThan(r.scores.model.brier + 0.01);
  });
});
