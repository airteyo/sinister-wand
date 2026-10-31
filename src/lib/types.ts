import type { SportKey } from './sports';

export interface MarketSnap {
  /** Home handicap, e.g. −3.5 means home lays 3.5. */
  spread: number;
  /** Decimal odds [home, away] on the spread. */
  spreadPrice: [number, number];
  total: number;
  /** Decimal odds [over, under]. */
  totalPrice: [number, number];
  /** Decimal odds [home, away] or [home, away, draw]. */
  ml: number[];
}

export interface BookQuote {
  book: string;
  /** A synthetic no-vig reference line (consensus); used for fair prices, never bet into. */
  reference?: boolean;
  open: MarketSnap;
  current: MarketSnap;
  close?: MarketSnap;
}

export interface LineTick { t: number; spread: number; total: number; pHome: number }

export interface Game {
  id: string;
  sport: SportKey;
  season: number;
  /** Global game-day index across all seasons. */
  day: number;
  date: string;
  home: string;
  away: string;
  homeRest: number;
  awayRest: number;
  books: BookQuote[];
  ticks: LineTick[];
  result?: { home: number; away: number };
  /** Live (Odds API) games carry a commence time. */
  commence?: string;
  live?: boolean;
}

export interface TeamRating {
  team: string;
  off: number;
  def: number;
  /** Variance of the off/def estimates. */
  pOff: number;
  pDef: number;
  /** Net rating: points (or goals) better than an average team on a neutral field. */
  net: number;
  games: number;
  w: number;
  l: number;
  t: number;
  history: { day: number; net: number }[];
  lastDay: number;
}

export interface Prediction {
  muHome: number;
  muAway: number;
  marginVar: number;
  adjustments: { label: string; value: number }[];
}
