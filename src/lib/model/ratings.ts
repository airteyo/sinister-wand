import type { SportConfig } from '../sports';
import type { Game, Prediction, TeamRating } from '../types';

export interface ModelParams {
  /** Scales day-to-day process noise on ratings. */
  volatility: number;
  /** Fraction of each rating regressed to the mean between seasons. */
  seasonRegression: number;
  /** Home advantage override (points or log-rate); null = sport default. */
  hfa: number | null;
  /** Scales the observation noise; >1 makes the filter react more slowly. */
  noiseScale: number;
  useRest: boolean;
  /** Weight on the model vs the de-vigged market when blending (0 = market only, 1 = model only). */
  marketWeight: number;
}

export const DEFAULT_PARAMS: ModelParams = {
  volatility: 1,
  seasonRegression: 0.33,
  hfa: null,
  noiseScale: 1,
  useRest: true,
  marketWeight: 0.3,
};

/** Per-game manual adjustments (injuries, weather, news), in points/goals for each side. */
export type ManualAdj = Record<string, { home: number; away: number; total: number; note?: string }>;

/**
 * Dynamic offence/defence ratings via a Kalman filter.
 *
 *   Margin sports:  E[score_home] = avg + off_h − def_a + hfa/2           (linear, exact Kalman update)
 *   Count sports:   log λ_home    = log avg + off_h − def_a + hfa/2       (extended Kalman, Poisson/NB observation)
 *
 * Between game-days each rating's variance grows with the elapsed time (random-walk talent drift),
 * so recent games carry more weight and early-season estimates are appropriately uncertain.
 */
export class RatingModel {
  readonly teams = new Map<string, TeamRating>();
  private avg: number;
  private currentSeason = -1;
  private readonly hfa: number;
  private readonly R: number;
  private readonly q: number;
  private readonly prior: number;

  constructor(readonly cfg: SportConfig, readonly params: ModelParams = DEFAULT_PARAMS) {
    this.avg = cfg.avgScore;
    this.hfa = params.hfa ?? cfg.hfa;
    this.prior = (cfg.talentSd ** 2) / 2;
    this.q = (cfg.drift * params.volatility) ** 2 / 2;
    this.R = cfg.scoreModel === 'margin' ? ((cfg.marginSd ** 2 + cfg.totalSd ** 2) / 4) * params.noiseScale : params.noiseScale;
  }

  team(name: string): TeamRating {
    let t = this.teams.get(name);
    if (!t) {
      t = { team: name, off: 0, def: 0, pOff: this.prior, pDef: this.prior, net: 0, games: 0, w: 0, l: 0, t: 0, history: [], lastDay: -1 };
      this.teams.set(name, t);
    }
    return t;
  }

  private startSeason(season: number) {
    if (this.currentSeason === -1) {
      this.currentSeason = season;
      return;
    }
    this.currentSeason = season;
    const r = this.params.seasonRegression;
    for (const t of this.teams.values()) {
      t.off *= 1 - r;
      t.def *= 1 - r;
      t.pOff = t.pOff * (1 - r) ** 2 + this.prior * r * 1.2;
      t.pDef = t.pDef * (1 - r) ** 2 + this.prior * r * 1.2;
      t.w = t.l = t.t = 0;
      t.games = 0;
      this.setNet(t);
    }
  }

  private age(t: TeamRating, day: number) {
    if (t.lastDay >= 0 && day > t.lastDay) {
      const steps = day - t.lastDay;
      t.pOff = Math.min(this.prior * 2, t.pOff + this.q * steps);
      t.pDef = Math.min(this.prior * 2, t.pDef + this.q * steps);
    }
  }

  private setNet(t: TeamRating) {
    if (this.cfg.scoreModel === 'margin') t.net = t.off + t.def;
    else t.net = this.avg * (Math.exp(t.off) - Math.exp(-t.def));
  }

  predict(g: Game, adj?: { home: number; away: number; total: number }): Prediction {
    const h = this.team(g.home), a = this.team(g.away);
    const adjustments: Prediction['adjustments'] = [];
    const cfg = this.cfg;
    let restH = 0, restA = 0;
    if (this.params.useRest && cfg.b2bPenalty) {
      if (g.homeRest === 0) restH = -cfg.b2bPenalty;
      if (g.awayRest === 0) restA = -cfg.b2bPenalty;
    }
    const pVar = h.pOff + h.pDef + a.pOff + a.pDef;
    if (cfg.scoreModel === 'margin') {
      let muH = this.avg + h.off - a.def + this.hfa / 2 + restH / 2 - restA / 2;
      let muA = this.avg + a.off - h.def - this.hfa / 2 + restA / 2 - restH / 2;
      adjustments.push({ label: 'Home field', value: this.hfa });
      if (restH) adjustments.push({ label: `${g.home.split(' ').pop()} back-to-back`, value: restH });
      if (restA) adjustments.push({ label: `${g.away.split(' ').pop()} back-to-back`, value: -restA });
      if (adj) {
        muH += adj.home + adj.total / 2;
        muA += adj.away + adj.total / 2;
        if (adj.home - adj.away) adjustments.push({ label: 'Manual (injuries/news)', value: adj.home - adj.away });
      }
      return { muHome: muH, muAway: muA, marginVar: pVar, adjustments };
    }
    const lh = Math.log(this.avg) + h.off - a.def + this.hfa / 2 + restH / 2 - restA / 2;
    const la = Math.log(this.avg) + a.off - h.def - this.hfa / 2 + restA / 2 - restH / 2;
    adjustments.push({ label: 'Home ice/field', value: this.avg * (Math.exp(this.hfa / 2) - Math.exp(-this.hfa / 2)) });
    if (restH) adjustments.push({ label: `${g.home.split(' ').pop()} back-to-back`, value: this.avg * restH });
    if (restA) adjustments.push({ label: `${g.away.split(' ').pop()} back-to-back`, value: -this.avg * restA });
    let muH = Math.exp(lh), muA = Math.exp(la);
    if (adj) {
      muH = Math.max(0.1, muH + adj.home + adj.total / 2);
      muA = Math.max(0.1, muA + adj.away + adj.total / 2);
      if (adj.home - adj.away) adjustments.push({ label: 'Manual (injuries/news)', value: adj.home - adj.away });
    }
    return { muHome: muH, muAway: muA, marginVar: pVar * this.avg ** 2, adjustments };
  }

  /** Observe one completed game and update both teams. */
  update(g: Game, pred: Prediction) {
    if (!g.result) return;
    const h = this.team(g.home), a = this.team(g.away);
    const { home: sh, away: sa } = g.result;
    const cfg = this.cfg;
    if (cfg.scoreModel === 'margin') {
      // home score informs off_h (+) and def_a (−)
      const eH = sh - pred.muHome, eA = sa - pred.muAway;
      const S1 = h.pOff + a.pDef + this.R, S2 = a.pOff + h.pDef + this.R;
      const k1o = h.pOff / S1, k1d = a.pDef / S1, k2o = a.pOff / S2, k2d = h.pDef / S2;
      h.off += k1o * eH; a.def -= k1d * eH;
      a.off += k2o * eA; h.def -= k2d * eA;
      h.pOff *= 1 - k1o; a.pDef *= 1 - k1d; a.pOff *= 1 - k2o; h.pDef *= 1 - k2d;
      // slow drift of the league scoring environment
      this.avg += 0.002 * ((sh + sa) / 2 - this.avg);
    } else {
      const upd = (obs: number, lam: number, off: TeamRating, def: TeamRating) => {
        // EKF: d λ / d θ = λ ; observation variance = λ + λ²/r
        const Rv = (lam + (isFinite(cfg.dispersion) ? lam * lam / cfg.dispersion : 0)) * this.R;
        const S = lam * lam * (off.pOff + def.pDef) + Rv;
        const ko = (off.pOff * lam) / S, kd = (def.pDef * lam) / S;
        const e = obs - lam;
        off.off += ko * e;
        def.def -= kd * e;
        off.pOff *= 1 - ko * lam;
        def.pDef *= 1 - kd * lam;
      };
      upd(sh, pred.muHome, h, a);
      upd(sa, pred.muAway, a, h);
      this.avg += 0.002 * ((sh + sa) / 2 - this.avg);
    }
    for (const [t, s, o] of [[h, sh, sa], [a, sa, sh]] as const) {
      t.games++;
      if (s > o) t.w++; else if (s < o) t.l++; else t.t++;
      t.lastDay = g.day;
      this.setNet(t);
      t.history.push({ day: g.day, net: t.net });
      if (t.history.length > 120) t.history.shift();
    }
  }

  /** Walk the schedule chronologically: predict every game before seeing its result. */
  run(games: Game[], adjustments: ManualAdj = {}): Map<string, Prediction> {
    const preds = new Map<string, Prediction>();
    const byDay = new Map<number, Game[]>();
    for (const g of games) {
      if (!byDay.has(g.day)) byDay.set(g.day, []);
      byDay.get(g.day)!.push(g);
    }
    for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
      const slate = byDay.get(day)!;
      if (slate[0].season !== this.currentSeason) this.startSeason(slate[0].season);
      for (const g of slate) {
        this.age(this.team(g.home), day);
        this.age(this.team(g.away), day);
      }
      for (const g of slate) preds.set(g.id, this.predict(g, adjustments[g.id]));
      for (const g of slate) this.update(g, preds.get(g.id)!);
    }
    return preds;
  }

  ranked(): TeamRating[] {
    return [...this.teams.values()].sort((a, b) => b.net - a.net);
  }

  get leagueAvg() {
    return this.avg;
  }
}
