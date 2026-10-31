import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketType, Side } from './analysis';
import { DEFAULT_BT, type BacktestConfig } from './backtest';
import { DEFAULT_PARAMS, type ManualAdj, type ModelParams } from './model/ratings';
import type { DevigMethod } from './odds';
import type { SportKey } from './sports';
import type { Game } from './types';

export type Page = 'overview' | 'board' | 'game' | 'ratings' | 'lab' | 'bets' | 'tools' | 'settings';

export interface TrackedBet {
  id: string;
  sport: SportKey;
  gameId: string;
  placedAt: string;
  gameDate: string;
  matchup: string;
  label: string;
  market: MarketType;
  side: Side;
  line: number | null;
  book: string;
  decimal: number;
  stake: number;
  pWin: number;
  ev: number;
  status: 'open' | 'W' | 'L' | 'P';
  pnl: number;
  clv?: number;
  closeDecimal?: number;
  source: 'demo' | 'live' | 'manual';
}

export interface SlipItem {
  key: string;
  sport: SportKey;
  gameId: string;
  gameDate: string;
  matchup: string;
  label: string;
  market: MarketType;
  side: Side;
  line: number | null;
  book: string;
  decimal: number;
  pWin: number;
  ev: number;
  kelly: number;
  stake: number;
  source: 'demo' | 'live';
}

export interface ImportedData {
  games: Game[];
  importedAt: string;
}

interface State {
  page: Page;
  gameId: string | null;
  sport: SportKey;
  seed: number;
  dayOffset: Partial<Record<SportKey, number>>;
  params: ModelParams;
  bt: BacktestConfig;
  devig: DevigMethod;
  minEdge: number;
  bankroll: number;
  kellyFraction: number;
  maxStakePct: number;
  oddsFormat: 'american' | 'decimal';
  dataMode: 'demo' | 'live';
  oddsApiKey: string;
  oddsRegions: string;
  imported: Partial<Record<SportKey, ImportedData>>;
  adjustments: ManualAdj;
  bets: TrackedBet[];
  slip: SlipItem[];
  slipOpen: boolean;

  go: (page: Page, gameId?: string | null) => void;
  set: (patch: Partial<State>) => void;
  setParams: (p: Partial<ModelParams>) => void;
  setBt: (p: Partial<BacktestConfig>) => void;
  advance: (n: number) => void;
  resetDay: () => void;
  setAdj: (gameId: string, adj: ManualAdj[string] | null) => void;
  addToSlip: (item: SlipItem) => void;
  removeFromSlip: (key: string) => void;
  updateSlip: (key: string, stake: number) => void;
  placeSlip: () => void;
  addBet: (b: TrackedBet) => void;
  updateBet: (id: string, patch: Partial<TrackedBet>) => void;
  removeBet: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      page: 'overview',
      gameId: null,
      sport: 'nfl',
      seed: 7,
      dayOffset: {},
      params: DEFAULT_PARAMS,
      bt: DEFAULT_BT,
      devig: 'shin',
      minEdge: 0.02,
      bankroll: 10000,
      kellyFraction: 0.25,
      maxStakePct: 0.03,
      oddsFormat: 'american',
      dataMode: 'demo',
      oddsApiKey: '',
      oddsRegions: 'us,eu',
      imported: {},
      adjustments: {},
      bets: [],
      slip: [],
      slipOpen: false,

      go: (page, gameId = null) => {
        set({ page, gameId: gameId ?? (page === 'game' ? get().gameId : null) });
        window.scrollTo({ top: 0 });
      },
      set: (patch) => set(patch),
      setParams: (p) => set({ params: { ...get().params, ...p } }),
      setBt: (p) => set({ bt: { ...get().bt, ...p } }),
      advance: (n) => {
        const { sport, dayOffset } = get();
        set({ dayOffset: { ...dayOffset, [sport]: (dayOffset[sport] ?? 0) + n } });
      },
      resetDay: () => {
        const { sport, dayOffset, bets } = get();
        // rewinding time invalidates simulated bets on this sport
        set({ dayOffset: { ...dayOffset, [sport]: 0 }, bets: bets.filter((b) => !(b.sport === sport && b.source === 'demo')) });
      },
      setAdj: (gameId, adj) => {
        const next = { ...get().adjustments };
        if (adj) next[gameId] = adj; else delete next[gameId];
        set({ adjustments: next });
      },
      addToSlip: (item) => {
        const slip = get().slip.filter((s) => s.key !== item.key);
        set({ slip: [...slip, item], slipOpen: true });
      },
      removeFromSlip: (key) => set({ slip: get().slip.filter((s) => s.key !== key) }),
      updateSlip: (key, stake) => set({ slip: get().slip.map((s) => (s.key === key ? { ...s, stake } : s)) }),
      placeSlip: () => {
        const now = new Date().toISOString();
        const placed: TrackedBet[] = get().slip.filter((s) => s.stake > 0).map((s) => ({
          id: uid(), sport: s.sport, gameId: s.gameId, placedAt: now, gameDate: s.gameDate, matchup: s.matchup, label: s.label,
          market: s.market, side: s.side, line: s.line, book: s.book, decimal: s.decimal, stake: s.stake,
          pWin: s.pWin, ev: s.ev, status: 'open', pnl: 0, source: s.source,
        }));
        set({ bets: [...placed, ...get().bets], slip: [], slipOpen: false });
      },
      addBet: (b) => set({ bets: [b, ...get().bets] }),
      updateBet: (id, patch) => set({ bets: get().bets.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
      removeBet: (id) => set({ bets: get().bets.filter((b) => b.id !== id) }),
    }),
    {
      name: 'edgelab-v1',
      partialize: (s) => {
        const { page: _p, gameId: _g, slipOpen: _o, ...rest } = s;
        void _p; void _g; void _o;
        return rest;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, params: { ...current.params, ...p.params }, bt: { ...current.bt, ...p.bt } };
      },
    },
  ),
);

export { uid };
