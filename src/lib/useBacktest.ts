import { useMemo } from 'react';
import { useEng } from '../components/EngineContext';
import { runBacktest, type BacktestConfig } from './backtest';
import { SPORTS } from './sports';

export function useBacktest(bt: BacktestConfig, seasons: number[] | 'all') {
  const eng = useEng();
  return useMemo(() => {
    if (eng.mode !== 'demo') return null;
    const s = seasons === 'all' ? [...new Set(eng.games.map((g) => g.season))] : seasons;
    return runBacktest(SPORTS[eng.sport], eng.games, eng.preds, bt, s);
  }, [eng.mode, eng.games, eng.preds, eng.sport, bt, seasons]);
}
