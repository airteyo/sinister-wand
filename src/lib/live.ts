import { devig } from './odds';
import { SPORTS, type SportKey } from './sports';
import type { BookQuote, Game, MarketSnap } from './types';

/** The Odds API (https://the-odds-api.com) v4 response shape, trimmed to what we use. */
interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    markets: { key: 'h2h' | 'spreads' | 'totals'; outcomes: { name: string; price: number; point?: number }[] }[];
  }[];
}

export interface LiveFetch {
  games: Game[];
  remaining: string | null;
  used: string | null;
  fetchedAt: string;
}

export const dayIndex = (date: Date, step: number) => Math.floor(date.getTime() / 864e5 / step);

/** Season label the way leagues name them (NFL 2026 runs into Jan 2027). */
export function seasonOf(sport: SportKey, d: Date) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (sport === 'mlb') return y;
  return m >= 6 ? y : y - 1;
}

const NaNSnap = (): MarketSnap => ({ spread: NaN, spreadPrice: [NaN, NaN], total: NaN, totalPrice: [NaN, NaN], ml: [] });

function toSnap(ev: OddsApiEvent, bm: OddsApiEvent['bookmakers'][number], threeWay: boolean): MarketSnap {
  const s = NaNSnap();
  for (const mk of bm.markets) {
    if (mk.key === 'h2h') {
      const h = mk.outcomes.find((o) => o.name === ev.home_team)?.price;
      const a = mk.outcomes.find((o) => o.name === ev.away_team)?.price;
      const d = mk.outcomes.find((o) => o.name === 'Draw')?.price;
      if (h && a) s.ml = threeWay ? (d ? [h, a, d] : []) : [h, a];
    } else if (mk.key === 'spreads') {
      const h = mk.outcomes.find((o) => o.name === ev.home_team);
      const a = mk.outcomes.find((o) => o.name === ev.away_team);
      if (h && a && h.point !== undefined) {
        s.spread = h.point;
        s.spreadPrice = [h.price, a.price];
      }
    } else if (mk.key === 'totals') {
      const o = mk.outcomes.find((x) => x.name === 'Over');
      const u = mk.outcomes.find((x) => x.name === 'Under');
      if (o && u && o.point !== undefined) {
        s.total = o.point;
        s.totalPrice = [o.price, u.price];
      }
    }
  }
  return s;
}

const mode = (xs: number[]) => {
  const c = new Map<number, number>();
  xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/**
 * No-vig reference line: Pinnacle if offered (the sharpest widely available book),
 * otherwise the average de-vigged probability across every book at the modal line.
 */
function referenceBook(books: BookQuote[]): BookQuote | null {
  const pin = books.find((b) => b.book.toLowerCase().includes('pinnacle'));
  const src = pin ? [pin] : books;
  const ref = NaNSnap();
  const mls = src.map((b) => b.current.ml).filter((m) => m.length);
  if (mls.length) {
    const fair = mls.map((m) => devig(m, 'shin'));
    ref.ml = fair[0].map((_, i) => 1 / (fair.reduce((a, f) => a + f[i], 0) / fair.length));
  }
  const sl = mode(src.map((b) => b.current.spread).filter(isFinite));
  if (sl !== undefined) {
    const at = src.filter((b) => b.current.spread === sl).map((b) => devig(b.current.spreadPrice, 'multiplicative')[0]);
    const p = at.reduce((a, b) => a + b, 0) / at.length;
    ref.spread = sl;
    ref.spreadPrice = [1 / p, 1 / (1 - p)];
  }
  const tl = mode(src.map((b) => b.current.total).filter(isFinite));
  if (tl !== undefined) {
    const at = src.filter((b) => b.current.total === tl).map((b) => devig(b.current.totalPrice, 'multiplicative')[0]);
    const p = at.reduce((a, b) => a + b, 0) / at.length;
    ref.total = tl;
    ref.totalPrice = [1 / p, 1 / (1 - p)];
  }
  if (!ref.ml.length && !isFinite(ref.spread)) return null;
  return { book: 'Sharp', reference: true, open: ref, current: ref };
}

export async function fetchLiveOdds(sport: SportKey, apiKey: string, regions = 'us,eu'): Promise<LiveFetch> {
  const cfg = SPORTS[sport];
  const url = `https://api.the-odds-api.com/v4/sports/${cfg.oddsApiKey}/odds?apiKey=${encodeURIComponent(apiKey)}&regions=${encodeURIComponent(regions)}&markets=h2h,spreads,totals&oddsFormat=decimal&dateFormat=iso`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Odds API ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  const data = (await res.json()) as OddsApiEvent[];
  const games: Game[] = data.map((ev) => {
    const when = new Date(ev.commence_time);
    const books: BookQuote[] = ev.bookmakers.map((bm) => {
      const snap = toSnap(ev, bm, cfg.threeWay);
      return { book: bm.title, open: snap, current: snap };
    });
    const ref = referenceBook(books);
    return {
      id: `live-${ev.id}`, sport, season: seasonOf(sport, when), day: dayIndex(when, cfg.dayStep), date: ev.commence_time.slice(0, 10),
      home: ev.home_team, away: ev.away_team, homeRest: 2, awayRest: 2,
      books: ref ? [ref, ...books] : books, ticks: [], commence: ev.commence_time, live: true,
    };
  });
  return { games, remaining: res.headers.get('x-requests-remaining'), used: res.headers.get('x-requests-used'), fetchedAt: new Date().toISOString() };
}

/**
 * Parse historical results: header row with date, home, away, home score, away score
 * (column names are matched loosely, e.g. "home_team", "HomeScore", "FTHG").
 */
export function parseResultsCsv(sport: SportKey, text: string): { games: Game[]; errors: string[] } {
  const cfg = SPORTS[sport];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { games: [], errors: ['File has no data rows.'] };
  const split = (l: string) => {
    const out: string[] = [];
    let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if ((ch === ',' || ch === ';' || ch === '\t') && !q) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const find = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iDate = find('date', 'gamedate', 'commencetime', 'day');
  const iHome = find('home', 'hometeam', 'team1');
  const iAway = find('away', 'awayteam', 'visitor', 'visitorteam', 'road', 'team2');
  const iHs = find('homescore', 'homepts', 'hs', 'fthg', 'score1', 'homegoals', 'homeruns', 'ptshome');
  const iAs = find('awayscore', 'awaypts', 'as', 'ftag', 'score2', 'awaygoals', 'awayruns', 'visitorscore', 'ptsaway');
  const missing = [['date', iDate], ['home', iHome], ['away', iAway], ['home_score', iHs], ['away_score', iAs]].filter(([, i]) => i === -1).map(([n]) => n);
  if (missing.length) return { games: [], errors: [`Missing column(s): ${missing.join(', ')}. Expected header like: date,home,away,home_score,away_score`] };
  const games: Game[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((l, i) => {
    const c = split(l);
    const raw = c[iDate];
    const dm = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    const d = dm ? new Date(Date.UTC(+(dm[3].length === 2 ? '20' + dm[3] : dm[3]), +dm[2] - 1, +dm[1])) : new Date(raw);
    const hs = Number(c[iHs]), as = Number(c[iAs]);
    if (isNaN(d.getTime()) || !c[iHome] || !c[iAway] || !isFinite(hs) || !isFinite(as)) {
      if (errors.length < 5) errors.push(`Row ${i + 2}: could not parse`);
      return;
    }
    games.push({
      id: `imp-${sport}-${i}`, sport, season: seasonOf(sport, d), day: dayIndex(d, cfg.dayStep), date: d.toISOString().slice(0, 10),
      home: c[iHome], away: c[iAway], homeRest: 2, awayRest: 2, books: [], ticks: [], result: { home: hs, away: as },
    });
  });
  games.sort((a, b) => a.day - b.day);
  return { games, errors };
}
