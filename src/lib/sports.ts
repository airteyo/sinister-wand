export type SportKey = 'nfl' | 'nba' | 'nhl' | 'mlb' | 'epl';
export type ScoreModel = 'margin' | 'count';

export interface SportConfig {
  key: SportKey;
  name: string;
  league: string;
  scoreModel: ScoreModel;
  /** Average points per team per game. */
  avgScore: number;
  /** Home advantage in points (margin sports) or as a log-rate multiplier split across teams (count sports). */
  hfa: number;
  /** SD of game margin around expectation (margin sports). */
  marginSd: number;
  /** SD of game total around expectation (margin sports). */
  totalSd: number;
  /** Negative-binomial dispersion for count sports (Infinity = Poisson). */
  dispersion: number;
  /** Dixon–Coles low-score correlation parameter (count sports). */
  rho: number;
  threeWay: boolean;
  /** Points the overtime/extra-inning winner usually wins by. */
  otMargin: number;
  /** Sd of true team strength in points (margin) or log-rate (count) for the simulator. */
  talentSd: number;
  /** Day-to-day drift of true strength. */
  drift: number;
  gamesPerTeam: number;
  gameDaysPerSeason: number;
  /** Calendar days between consecutive game-days. */
  dayStep: number;
  spreadName: string;
  /** Standard spread line for count sports (puck line / run line). */
  fixedSpread?: number;
  /** Totals are offered in this increment. */
  totalStep: number;
  /** Integer margin frequency multipliers relative to a smooth normal (football key numbers). */
  keyNumbers?: Record<number, number>;
  oddsApiKey: string;
  /** Rest effect: points lost when on 0 days rest (back-to-back). */
  b2bPenalty: number;
  scoreUnit: string;
  accent: string;
}

export const SPORTS: Record<SportKey, SportConfig> = {
  nfl: {
    key: 'nfl', name: 'NFL', league: 'National Football League', scoreModel: 'margin',
    avgScore: 22.3, hfa: 1.7, marginSd: 13.4, totalSd: 13.8, dispersion: Infinity, rho: 0,
    threeWay: false, otMargin: 3, talentSd: 4.6, drift: 0.35, gamesPerTeam: 17, gameDaysPerSeason: 18, dayStep: 7,
    spreadName: 'Spread', totalStep: 0.5,
    keyNumbers: { 0: 0.12, 1: 0.95, 2: 0.85, 3: 2.75, 4: 1.15, 5: 0.85, 6: 1.35, 7: 1.95, 8: 1.05, 9: 0.75, 10: 1.4, 11: 0.85, 12: 0.75, 13: 0.9, 14: 1.4, 15: 0.85, 16: 1.0, 17: 1.15, 18: 0.9, 19: 0.8, 20: 0.95, 21: 1.15 },
    oddsApiKey: 'americanfootball_nfl', b2bPenalty: 0, scoreUnit: 'pts', accent: '#34d399',
  },
  nba: {
    key: 'nba', name: 'NBA', league: 'National Basketball Association', scoreModel: 'margin',
    avgScore: 114.5, hfa: 2.4, marginSd: 12.2, totalSd: 18.5, dispersion: Infinity, rho: 0,
    threeWay: false, otMargin: 4, talentSd: 4.8, drift: 0.12, gamesPerTeam: 82, gameDaysPerSeason: 165, dayStep: 1,
    spreadName: 'Spread', totalStep: 0.5, oddsApiKey: 'basketball_nba', b2bPenalty: 1.6, scoreUnit: 'pts', accent: '#f59e0b',
  },
  nhl: {
    key: 'nhl', name: 'NHL', league: 'National Hockey League', scoreModel: 'count',
    avgScore: 3.05, hfa: 0.045, marginSd: 0, totalSd: 0, dispersion: Infinity, rho: -0.04,
    threeWay: false, otMargin: 1, talentSd: 0.12, drift: 0.006, gamesPerTeam: 82, gameDaysPerSeason: 175, dayStep: 1,
    spreadName: 'Puck line', fixedSpread: 1.5, totalStep: 0.5, oddsApiKey: 'icehockey_nhl', b2bPenalty: 0.04, scoreUnit: 'goals', accent: '#38bdf8',
  },
  mlb: {
    key: 'mlb', name: 'MLB', league: 'Major League Baseball', scoreModel: 'count',
    avgScore: 4.45, hfa: 0.035, marginSd: 0, totalSd: 0, dispersion: 6.5, rho: 0,
    threeWay: false, otMargin: 1, talentSd: 0.1, drift: 0.004, gamesPerTeam: 162, gameDaysPerSeason: 182, dayStep: 1,
    spreadName: 'Run line', fixedSpread: 1.5, totalStep: 0.5, oddsApiKey: 'baseball_mlb', b2bPenalty: 0, scoreUnit: 'runs', accent: '#f87171',
  },
  epl: {
    key: 'epl', name: 'EPL', league: 'English Premier League', scoreModel: 'count',
    avgScore: 1.42, hfa: 0.11, marginSd: 0, totalSd: 0, dispersion: Infinity, rho: -0.12,
    threeWay: true, otMargin: 0, talentSd: 0.3, drift: 0.01, gamesPerTeam: 38, gameDaysPerSeason: 38, dayStep: 7,
    spreadName: 'Asian handicap', totalStep: 0.5, oddsApiKey: 'soccer_epl', b2bPenalty: 0, scoreUnit: 'goals', accent: '#a78bfa',
  },
};

export const SPORT_KEYS = Object.keys(SPORTS) as SportKey[];
