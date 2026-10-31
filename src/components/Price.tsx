import clsx from 'clsx';
import { selectionLabel, type Evaluation } from '../lib/analysis';
import { disagreement } from '../lib/backtest';
import { useOdds } from '../lib/format';
import { useStore } from '../lib/store';
import type { Game } from '../lib/types';
import { useBankroll } from './BetSlip';

export function useAddToSlip() {
  const { addToSlip, kellyFraction, maxStakePct } = useStore();
  const bank = useBankroll();
  return (g: Game, e: Evaluation, source: 'demo' | 'live') => {
    const frac = Math.min(maxStakePct, e.kelly * kellyFraction);
    const stake = Math.max(0, Math.round(bank.current * frac));
    addToSlip({
      key: `${g.id}:${e.market}:${e.side}`,
      sport: g.sport, gameId: g.id, gameDate: g.date, matchup: `${g.away} @ ${g.home}`,
      label: selectionLabel(g, e.market, e.side, e.line), market: e.market, side: e.side, line: e.line, book: e.book,
      decimal: e.decimal, pWin: e.blend.win, ev: e.ev, kelly: e.kelly, stake: stake || 0, source,
    });
  };
}

/** A clickable price cell: line, best price, and the edge versus the blended fair probability. */
export function PriceButton({ g, e, line, source, compact }: { g: Game; e?: Evaluation; line?: string; source: 'demo' | 'live'; compact?: boolean }) {
  const odds = useOdds();
  const minEdge = useStore((s) => s.minEdge);
  const maxDis = useStore((s) => s.bt.maxDisagreement);
  const add = useAddToSlip();
  const inSlip = useStore((s) => (e ? s.slip.some((x) => x.key === `${g.id}:${e.market}:${e.side}`) : false));
  if (!e) return <div className="flex h-[46px] items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-faint">—</div>;
  const suspect = disagreement(e) > maxDis;
  const hot = e.ev >= minEdge && !suspect;
  return (
    <button
      onClick={(ev) => { ev.stopPropagation(); add(g, e, source); }}
      title={`${e.book} · model ${(e.model.win * 100).toFixed(1)}% · market ${(e.market_.win * 100).toFixed(1)}% · blend ${(e.blend.win * 100).toFixed(1)}%${suspect && e.ev > 0 ? ' · model and market disagree sharply: likely missing news, not edge' : ''}`}
      className={clsx(
        'group relative flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 text-left transition-all hover:-translate-y-px',
        compact ? 'h-[38px]' : 'h-[46px]',
        inSlip ? 'border-pos bg-pos/15' : suspect && e.ev >= minEdge ? 'border-warn/30 bg-warn/[0.05] hover:border-warn/60' : hot ? 'border-pos/40 bg-pos/[0.07] hover:border-pos/70' : 'border-line bg-panel-2 hover:border-line-2 hover:bg-panel-3',
      )}
    >
      <div className="min-w-0 leading-tight">
        {line && <div className="num truncate text-[12px] font-medium text-fg-2">{line}</div>}
        {!compact && <div className="truncate text-[10px] text-faint">{e.book}</div>}
      </div>
      <div className="text-right leading-tight">
        <div className="num text-[13px] font-semibold">{odds(e.decimal)}</div>
        <div className={clsx('num text-[10px]', hot ? 'text-pos' : suspect && e.ev >= minEdge ? 'text-warn' : e.ev >= 0 ? 'text-info' : 'text-faint')}>{e.ev > 0 ? '+' : ''}{(e.ev * 100).toFixed(1)}%</div>
      </div>
    </button>
  );
}
