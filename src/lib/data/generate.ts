import { BOOKS, quote } from '../model/market';
import { priceGame } from '../model/pricing';
import { Rng, hashSeed } from '../rng';
import { SPORTS, type SportConfig, type SportKey } from '../sports';
import type { BookQuote, Game } from '../types';
import { TEAMS } from './teams';

/**
 * A simulated league "universe": latent team talent evolves over three seasons, every game is
 * played out from that talent, and a market of five books prices each game from a noisy view of it.
 * The model never sees the talent — only scores and prices — exactly like the real world.
 */
export interface World {
  sport: SportKey;
  seed: number;
  games: Game[];
  /** Results and closing lines are revealed only for game-days before `today`. */
  results: Map<string, { home: number; away: number }>;
  closes: Map<string, BookQuote['close'][]>;
  /** The true expected scores (hidden from the model; used for the "oracle" diagnostic only). */
  truth: Map<string, { muHome: number; muAway: number }>;
  initialToday: number;
  lastDay: number;
  seasons: number[];
}

const CURRENT_SEASON = 2026;
const TODAY = new Date('2026-10-31T12:00:00');

const MARKET_NOISE: Record<SportKey, { open: [number, number]; close: [number, number] }> = {
  nfl: { open: [1.25, 1.6], close: [0.8, 1.0] },
  nba: { open: [1.35, 2.3], close: [0.85, 1.4] },
  nhl: { open: [0.05, 0.05], close: [0.032, 0.032] },
  mlb: { open: [0.05, 0.05], close: [0.032, 0.032] },
  epl: { open: [0.09, 0.075], close: [0.055, 0.05] },
};

function roundRobin(n: number): [number, number][][] {
  const idx = [...Array(n).keys()];
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = idx[i], b = idx[n - 1 - i];
      pairs.push(r % 2 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    idx.splice(1, 0, idx.pop()!);
  }
  return [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a] as [number, number]))];
}

function schedule(cfg: SportConfig, rng: Rng, n: number): [number, number][][] {
  if (cfg.key === 'epl') return rng.shuffle(roundRobin(n));
  const days: [number, number][][] = [];
  const perDay = Math.max(1, Math.round((n * cfg.gamesPerTeam) / cfg.gameDaysPerSeason / 2));
  let series: [number, number][] = [];
  for (let d = 0; d < cfg.gameDaysPerSeason; d++) {
    if (cfg.key === 'mlb' && d % 3 !== 0) {
      days.push(series);
      continue;
    }
    const order = rng.shuffle([...Array(n).keys()]);
    const pairs: [number, number][] = [];
    for (let i = 0; i + 1 < order.length && pairs.length < perDay; i += 2) pairs.push([order[i], order[i + 1]]);
    series = pairs;
    days.push(pairs);
  }
  return days;
}

/** Market belief errors per game, used to rebuild intraday line movement on demand. */
const lineErr = new Map<string, { open: number[]; close: number[]; muH: number; muA: number }>();

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function generateWorld(sport: SportKey, seed = 7): World {
  const cfg = SPORTS[sport];
  const rng = new Rng(hashSeed(sport, seed));
  const teams = TEAMS[sport].map((t) => t.name);
  const n = teams.length;
  const noise = MARKET_NOISE[sport];
  const seasons = [CURRENT_SEASON - 2, CURRENT_SEASON - 1, CURRENT_SEASON];

  // latent talent: offence/defence plus a team-specific home edge the model can't see
  const off = teams.map(() => rng.normal(0, cfg.talentSd / Math.SQRT2));
  const def = teams.map(() => rng.normal(0, cfg.talentSd / Math.SQRT2));
  const homeEdge = teams.map(() => rng.normal(0, cfg.hfa * 0.35));

  const games: Game[] = [];
  const results = new Map<string, { home: number; away: number }>();
  const closes = new Map<string, BookQuote['close'][]>();
  const truth = new Map<string, { muHome: number; muAway: number }>();
  const todayInSeason = Math.floor(cfg.gameDaysPerSeason * 0.42);
  const initialToday = 2 * cfg.gameDaysPerSeason + todayInSeason;
  let globalDay = 0;

  for (const season of seasons) {
    if (season !== seasons[0]) {
      for (let i = 0; i < n; i++) {
        off[i] = off[i] * 0.68 + rng.normal(0, cfg.talentSd * 0.42);
        def[i] = def[i] * 0.68 + rng.normal(0, cfg.talentSd * 0.42);
      }
    }
    const seasonStart = new Date(TODAY.getTime() - (todayInSeason * cfg.dayStep + (CURRENT_SEASON - season) * 365) * 864e5);
    const lastPlayed = new Array(n).fill(-99);
    const days = schedule(cfg, rng, n);
    days.forEach((pairs, dIdx) => {
      for (let i = 0; i < n; i++) {
        off[i] += rng.normal(0, cfg.drift);
        def[i] += rng.normal(0, cfg.drift);
      }
      const date = isoDate(new Date(seasonStart.getTime() + dIdx * cfg.dayStep * 864e5));
      pairs.forEach(([h, a], gi) => {
        const homeRest = dIdx - lastPlayed[h] - 1, awayRest = dIdx - lastPlayed[a] - 1;
        lastPlayed[h] = lastPlayed[a] = dIdx;
        const hfa = cfg.hfa + homeEdge[h];
        const restH = homeRest === 0 ? -cfg.b2bPenalty : 0, restA = awayRest === 0 ? -cfg.b2bPenalty : 0;
        let muH: number, muA: number;
        if (cfg.scoreModel === 'margin') {
          muH = cfg.avgScore + off[h] - def[a] + hfa / 2 + (restH - restA) / 2;
          muA = cfg.avgScore + off[a] - def[h] - hfa / 2 + (restA - restH) / 2;
        } else {
          muH = cfg.avgScore * Math.exp(off[h] - def[a] + hfa / 2 + (restH - restA) / 2);
          muA = cfg.avgScore * Math.exp(off[a] - def[h] - hfa / 2 + (restA - restH) / 2);
        }
        const id = `${sport}-${season}-${dIdx}-${gi}`;
        truth.set(id, { muHome: muH, muAway: muA });

        // play the game from the true distribution
        const trueDist = priceGame(cfg, muH, muA);
        let hs: number, as: number;
        if (cfg.scoreModel === 'margin') {
          let u = rng.next(), m = 0;
          for (let k = 0; k < trueDist.margin.values.length; k++) {
            u -= trueDist.margin.probs[k];
            if (u <= 0) { m = trueDist.margin.values[k]; break; }
          }
          const T = Math.max(Math.abs(m) + 3, Math.round(rng.normal(muH + muA, cfg.totalSd)));
          hs = Math.round((T + m) / 2);
          as = hs - m;
          if (as < 0) { as = 0; hs = m; }
        } else {
          hs = rng.negbin(muH, cfg.dispersion);
          as = rng.negbin(muA, cfg.dispersion);
          if (hs === as && !cfg.threeWay) {
            if (rng.next() < muH / (muH + muA)) hs += cfg.otMargin; else as += cfg.otMargin;
          }
        }
        results.set(id, { home: hs, away: as });

        // the market: open is noisier than close; close partially corrects the open error
        const eOpen = [rng.normal(0, noise.open[0]), rng.normal(0, noise.open[1])];
        const eClose = [eOpen[0] * 0.2 + rng.normal(0, noise.close[0]), eOpen[1] * 0.2 + rng.normal(0, noise.close[1])];
        const believe = (e: number[]) =>
          cfg.scoreModel === 'margin'
            ? priceGame(cfg, muH + (e[0] + e[1]) / 2, muA + (e[1] - e[0]) / 2)
            : priceGame(cfg, muH * Math.exp((e[0] + e[1]) / 2), muA * Math.exp((e[1] - e[0]) / 2));
        const openDist = believe(eOpen), closeDist = believe(eClose);
        const books: BookQuote[] = BOOKS.map((b) => {
          const open = quote(cfg, openDist, b, rng);
          return { book: b.name, open, current: open };
        });
        closes.set(id, BOOKS.map((b) => quote(cfg, closeDist, b, rng)));
        games.push({
          id, sport, season, day: globalDay + dIdx, date,
          home: teams[h], away: teams[a], homeRest: Math.min(homeRest, 9), awayRest: Math.min(awayRest, 9),
          books, ticks: [],
        });
        // stash for line-movement reconstruction
        lineErr.set(id, { open: eOpen, close: eClose, muH, muA });
      });
    });
    globalDay += days.length;
  }
  return { sport, seed, games, results, closes, truth, initialToday, lastDay: globalDay - 1, seasons };
}

/** Rebuild the intraday consensus line path between open and close for charting. */
export function lineTicks(g: Game, upTo = 1, steps = 12) {
  const cfg = SPORTS[g.sport];
  const e = lineErr.get(g.id);
  if (!e) return [];
  const rng = new Rng(hashSeed(g.id, 'ticks'));
  const out = [];
  let wander = [0, 0];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * upTo;
    wander = [wander[0] * 0.6 + rng.normal(0, 0.15), wander[1] * 0.6 + rng.normal(0, 0.15)];
    const bridge = Math.sin(Math.PI * t);
    const err = [0, 1].map((k) => e.open[k] * (1 - t) + e.close[k] * t + wander[k] * bridge * (cfg.scoreModel === 'margin' ? 1 : 0.05));
    const dist =
      cfg.scoreModel === 'margin'
        ? priceGame(cfg, e.muH + (err[0] + err[1]) / 2, e.muA + (err[1] - err[0]) / 2)
        : priceGame(cfg, e.muH * Math.exp((err[0] + err[1]) / 2), e.muA * Math.exp((err[1] - err[0]) / 2));
    const s = quote(cfg, dist, BOOKS[0], null);
    out.push({ t, spread: s.spread, total: s.total, pHome: dist.pHome });
  }
  return out;
}

/** Current (pre-game) quote for today's games: partway from open to close. */
export function currentQuotes(g: Game, progress: number): BookQuote[] {
  const cfg = SPORTS[g.sport];
  const e = lineErr.get(g.id);
  if (!e) return g.books;
  const err = [0, 1].map((k) => e.open[k] * (1 - progress) + e.close[k] * progress);
  const dist =
    cfg.scoreModel === 'margin'
      ? priceGame(cfg, e.muH + (err[0] + err[1]) / 2, e.muA + (err[1] - err[0]) / 2)
      : priceGame(cfg, e.muH * Math.exp((err[0] + err[1]) / 2), e.muA * Math.exp((err[1] - err[0]) / 2));
  const rng = new Rng(hashSeed(g.id, 'current', Math.round(progress * 100)));
  return g.books.map((b, i) => ({ ...b, current: quote(cfg, dist, BOOKS[i], rng) }));
}

/** Materialise the world as of `today`: reveal results + closing lines for past game-days, live quotes for today. */
export function worldAt(w: World, today: number): Game[] {
  return w.games.map((g) => {
    if (g.day < today) {
      const cl = w.closes.get(g.id)!;
      return { ...g, result: w.results.get(g.id), books: g.books.map((b, i) => ({ ...b, current: cl[i]!, close: cl[i] })) };
    }
    if (g.day === today) return { ...g, books: currentQuotes(g, 0.6) };
    return g;
  });
}
