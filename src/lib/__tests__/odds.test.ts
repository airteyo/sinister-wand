import { describe, expect, it } from 'vitest';
import { americanToDecimal, arbitrage, decimalToAmerican, devig, expectedValue, hedge, kelly, parlay } from '../odds';

describe('odds', () => {
  it('converts american <-> decimal', () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.9091, 4);
    expect(americanToDecimal(150)).toBe(2.5);
    expect(decimalToAmerican(1.9091)).toBe(-110);
    expect(decimalToAmerican(2.5)).toBe(150);
  });

  it('devigs a -110/-110 market to 50/50 with every method', () => {
    const d = americanToDecimal(-110);
    for (const m of ['multiplicative', 'additive', 'power', 'shin'] as const) {
      const [a, b] = devig([d, d], m);
      expect(a).toBeCloseTo(0.5, 6);
      expect(a + b).toBeCloseTo(1, 6);
    }
  });

  it('shin and power shade the favourite less than the longshot', () => {
    const prices = [americanToDecimal(-300), americanToDecimal(240)];
    const mult = devig(prices, 'multiplicative');
    const shin = devig(prices, 'shin');
    const power = devig(prices, 'power');
    expect(shin[0]).toBeGreaterThan(mult[0]);
    expect(power[0]).toBeGreaterThan(mult[0]);
    expect(shin[0] + shin[1]).toBeCloseTo(1, 6);
  });

  it('kelly and EV', () => {
    expect(expectedValue(0.55, 2)).toBeCloseTo(0.1, 9);
    expect(kelly(0.55, 2)).toBeCloseTo(0.1, 9);
    expect(kelly(0.4, 2)).toBe(0);
    // pushes shrink the effective sample: f = (pw b - pl)/(b (pw+pl))
    expect(kelly(0.5, 2, 0.1)).toBeCloseTo(0.1 / 0.9, 9);
  });

  it('parlay, hedge, arb', () => {
    const p = parlay([{ decimal: 2, prob: 0.5 }, { decimal: 2, prob: 0.5 }]);
    expect(p.decimal).toBe(4);
    expect(p.prob).toBeCloseTo(0.25);
    expect(parlay([{ decimal: 2, prob: 0.5 }, { decimal: 2, prob: 0.5 }], 0.3).prob).toBeGreaterThan(0.25);
    const h = hedge(100, 3, 1.5);
    expect(h.hedgeStake).toBeCloseTo(200);
    expect(h.lockedProfit).toBeCloseTo(0);
    expect(arbitrage(2.1, 2.1).isArb).toBe(true);
  });
});
