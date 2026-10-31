import { Ticket, Trash2, X } from 'lucide-react';
import { money, pct, spct, useOdds } from '../lib/format';
import { useStore } from '../lib/store';
import { Badge, Button, inputCls } from './ui';

export function useBankroll() {
  const bets = useStore((s) => s.bets);
  const start = useStore((s) => s.bankroll);
  const settled = bets.filter((b) => b.status !== 'open');
  const pnl = settled.reduce((a, b) => a + b.pnl, 0);
  const exposure = bets.filter((b) => b.status === 'open').reduce((a, b) => a + b.stake, 0);
  return { start, pnl, current: start + pnl, exposure, available: start + pnl - exposure };
}

export function BetSlip() {
  const { slip, slipOpen, set, removeFromSlip, updateSlip, placeSlip } = useStore();
  const odds = useOdds();
  const bank = useBankroll();
  const totalStake = slip.reduce((a, s) => a + s.stake, 0);
  const expProfit = slip.reduce((a, s) => a + s.stake * s.ev, 0);
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity ${slipOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => set({ slipOpen: false })} />
      <aside className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-line bg-panel shadow-2xl transition-transform duration-300 ${slipOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-pos" />
            <h2 className="text-sm font-semibold">Bet slip</h2>
            <Badge>{slip.length}</Badge>
          </div>
          <button onClick={() => set({ slipOpen: false })} className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-fg" aria-label="Close slip"><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {!slip.length && <div className="py-16 text-center text-xs text-muted">Click any price on the board to add it here.<br />Stakes are pre-filled with fractional Kelly.</div>}
          {slip.map((s) => (
            <div key={s.key} className="rounded-xl border border-line bg-panel-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{s.label}</div>
                  <div className="truncate text-[11px] text-muted">{s.matchup} · {s.book}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="num text-sm font-semibold">{odds(s.decimal)}</span>
                  <button onClick={() => removeFromSlip(s.key)} className="text-faint hover:text-neg" aria-label="Remove"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div><div className="text-muted">Win prob</div><div className="num text-fg">{pct(s.pWin)}</div></div>
                <div><div className="text-muted">Edge</div><div className={`num ${s.ev > 0 ? 'text-pos' : 'text-neg'}`}>{spct(s.ev)}</div></div>
                <div><div className="text-muted">Kelly</div><div className="num text-fg">{pct(s.kelly, 2)}</div></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted">$</span>
                  <input className={`${inputCls} pl-6`} type="number" min={0} value={s.stake} onChange={(e) => updateSlip(s.key, Math.max(0, Number(e.target.value)))} />
                </div>
                <div className="text-right text-[11px] text-muted">To win<div className="num text-xs text-fg">{money(s.stake * (s.decimal - 1), 2)}</div></div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t border-line p-4">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-muted">Total stake</div><div className="num font-semibold">{money(totalStake, 2)}</div></div>
            <div><div className="text-muted">Expected</div><div className={`num font-semibold ${expProfit >= 0 ? 'text-pos' : 'text-neg'}`}>{money(expProfit, 2)}</div></div>
            <div><div className="text-muted">Available</div><div className="num font-semibold">{money(bank.available)}</div></div>
          </div>
          <Button variant="primary" className="w-full" disabled={!slip.length || totalStake <= 0} onClick={placeSlip}>Track {slip.length || ''} bet{slip.length === 1 ? '' : 's'}</Button>
          <p className="text-center text-[10.5px] text-faint">Tracking only — EdgeLab never places real wagers.</p>
        </div>
      </aside>
    </>
  );
}
