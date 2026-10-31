import { useCallback, useEffect, useMemo, useState } from 'react';
import { bestPrices, distFor, evaluateGame, settle, type Evaluation } from './analysis';
import { closeFairWin } from './backtest';
import { generateWorld, worldAt, type World } from './data/generate';
import { dayIndex, fetchLiveOdds, type LiveFetch } from './live';
import { RatingModel } from './model/ratings';
import type { GameDist } from './model/pricing';
import { SPORTS, type SportKey } from './sports';
import { useStore } from './store';
import type { Game, Prediction } from './types';

const worldCache = new Map<string, World>();
export function getWorld(sport: SportKey, seed: number): World {
  const k = `${sport}:${seed}`;
  let w = worldCache.get(k);
  if (!w) {
    w = generateWorld(sport, seed);
    worldCache.set(k, w);
  }
  return w;
}

const liveCache = new Map<string, LiveFetch>();

export interface Engine {
  sport: SportKey;
  mode: 'demo' | 'live';
  today: number;
  todayLabel: string;
  seasonLabel: string;
  /** Every game known to the engine (history + slate + future). */
  games: Game[];
  gameById: Map<string, Game>;
  slate: Game[];
  upcoming: Game[];
  preds: Map<string, Prediction>;
  dists: Map<string, GameDist>;
  evals: Map<string, Evaluation[]>;
  best: Map<string, Evaluation[]>;
  model: RatingModel;
  hasModel: boolean;
  canAdvance: boolean;
  live: { loading: boolean; error: string | null; data: LiveFetch | null; refresh: () => void };
}

function dayLabel(sport: SportKey, slate: Game[], today: number, firstDayOfSeason: number) {
  const cfg = SPORTS[sport];
  const idx = today - firstDayOfSeason + 1;
  if (cfg.dayStep === 7) return sport === 'epl' ? `Matchweek ${idx}` : `Week ${idx}`;
  const d = slate[0]?.date;
  return d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : `Day ${idx}`;
}

export function useEngine(): Engine {
  const { sport, seed, dayOffset, params, adjustments, devig, dataMode, oddsApiKey, oddsRegions, imported } = useStore();
  const cfg = SPORTS[sport];
  const [liveState, setLive] = useState<{ loading: boolean; error: string | null; data: LiveFetch | null }>({ loading: false, error: null, data: null });
  const [nonce, setNonce] = useState(0);
  const mode: 'demo' | 'live' = dataMode === 'live' && oddsApiKey ? 'live' : 'demo';

  useEffect(() => {
    if (mode !== 'live') return;
    const key = `${sport}:${oddsRegions}`;
    const cached = liveCache.get(key);
    if (cached && !nonce && Date.now() - new Date(cached.fetchedAt).getTime() < 5 * 60e3) {
      setLive({ loading: false, error: null, data: cached });
      return;
    }
    let cancelled = false;
    setLive((s) => ({ ...s, loading: true, error: null }));
    fetchLiveOdds(sport, oddsApiKey, oddsRegions)
      .then((d) => {
        liveCache.set(key, d);
        if (!cancelled) setLive({ loading: false, error: null, data: d });
      })
      .catch((e: Error) => !cancelled && setLive({ loading: false, error: e.message, data: null }));
    return () => { cancelled = true; };
  }, [mode, sport, oddsApiKey, oddsRegions, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const base = useMemo(() => {
    if (mode === 'demo') {
      const world = getWorld(sport, seed);
      const today = Math.min(world.lastDay, world.initialToday + (dayOffset[sport] ?? 0));
      const games = worldAt(world, today);
      const curSeason = games.find((g) => g.day === today)?.season ?? world.seasons[world.seasons.length - 1];
      const firstDay = games.find((g) => g.season === curSeason)?.day ?? 0;
      return { games, today, firstDay, curSeason, canAdvance: today < world.lastDay };
    }
    const hist = imported[sport]?.games ?? [];
    const liveGames = liveState.data?.games ?? [];
    const today = dayIndex(new Date(), cfg.dayStep);
    const curSeason = liveGames[0]?.season ?? hist[hist.length - 1]?.season ?? new Date().getFullYear();
    return { games: [...hist, ...liveGames], today, firstDay: hist.find((g) => g.season === curSeason)?.day ?? today, curSeason, canAdvance: false };
  }, [mode, sport, seed, dayOffset, imported, liveState.data, cfg.dayStep]);

  const derived = useMemo(() => {
    const { games, today } = base;
    const model = new RatingModel(cfg, params);
    const horizon = mode === 'demo' ? today + (cfg.dayStep === 1 ? 3 : 1) : Infinity;
    const preds = model.run(games.filter((g) => g.day <= horizon), adjustments);
    const slate = mode === 'demo' ? games.filter((g) => g.day === today) : games.filter((g) => g.live).sort((a, b) => (a.commence ?? '').localeCompare(b.commence ?? ''));
    const upcoming = mode === 'demo' ? games.filter((g) => g.day > today && g.day <= horizon) : [];
    const hasModel = mode === 'demo' || (imported[sport]?.games.length ?? 0) > 0;
    const weight = hasModel ? params.marketWeight : 0;
    const dists = new Map<string, GameDist>();
    const evals = new Map<string, Evaluation[]>();
    const best = new Map<string, Evaluation[]>();
    for (const g of [...slate, ...upcoming]) {
      let p = preds.get(g.id);
      if (!p) continue;
      if (!hasModel) p = { ...p, marginVar: 0 };
      const d = distFor(cfg, p);
      dists.set(g.id, d);
      const ev = evaluateGame(cfg, g, d, { weight, devig, snap: 'current' });
      evals.set(g.id, ev);
      best.set(g.id, bestPrices(ev));
    }
    const gameById = new Map(games.map((g) => [g.id, g]));
    return { model, preds, slate, upcoming, dists, evals, best, hasModel, gameById };
  }, [base, cfg, params, adjustments, devig, mode, imported, sport]);

  // settle simulated bets as the clock moves forward
  const bets = useStore((s) => s.bets);
  const updateBet = useStore((s) => s.updateBet);
  useEffect(() => {
    if (mode !== 'demo') return;
    for (const b of bets) {
      if (b.status !== 'open' || b.sport !== sport || b.source !== 'demo') continue;
      const g = derived.gameById.get(b.gameId);
      if (!g?.result) continue;
      const res = settle(b.market, b.side, b.line, g.result);
      const pred = derived.preds.get(g.id);
      let clv: number | undefined;
      if (pred) {
        const cf = closeFairWin(g, { ...b, model: { win: 0, push: 0, loss: 0 } } as unknown as Evaluation, distFor(cfg, pred));
        if (cf !== null) clv = b.decimal * cf - 1;
      }
      updateBet(b.id, { status: res, pnl: res === 'W' ? b.stake * (b.decimal - 1) : res === 'L' ? -b.stake : 0, clv });
    }
  }, [derived, bets, mode, sport, updateBet, cfg]);

  return {
    sport, mode, today: base.today,
    todayLabel: mode === 'live' ? 'Live board' : dayLabel(sport, derived.slate, base.today, base.firstDay),
    seasonLabel: sport === 'mlb' ? `${base.curSeason}` : `${base.curSeason}–${String(base.curSeason + 1).slice(2)}`,
    games: base.games, ...derived, canAdvance: base.canAdvance,
    live: { ...liveState, refresh },
  };
}
