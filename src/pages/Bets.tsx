import clsx from 'clsx';
import { Download, Plus, Receipt, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useBankroll } from '../components/BetSlip';
import { Badge, Button, Card, chartTooltip, Empty, Field, inputCls, PageHeader, Segmented, Stat, Td, Th } from '../components/ui';
import { money, pct, smoney, spct, useOdds } from '../lib/format';
import { americanToDecimal, devig } from '../lib/odds';
import { SPORTS, SPORT_KEYS, type SportKey } from '../lib/sports';
import { uid, useStore, type TrackedBet } from '../lib/store';

export default function Bets() {
  const { bets, updateBet, removeBet, addBet, set, sport } = useStore();
  const odds = useOdds();
  const bank = useBankroll();
  const [status, setStatus] = useState<'all' | 'open' | 'settled'>('all');
  const [scope, setScope] = useState<'all' | 'sport'>('all');
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => bets.filter((b) => (status === 'all' || (status === 'open' ? b.status === 'open' : b.status !== 'open')) && (scope === 'all' || b.sport === sport)), [bets, status, scope, sport]);
  const settled = bets.filter((b) => b.status !== 'open');
  const staked = settled.reduce((a, b) => a + b.stake, 0);
  const profit = settled.reduce((a, b) => a + b.pnl, 0);
  const clvs = settled.filter((b) => b.clv !== undefined).map((b) => b.clv!);
  const w = settled.filter((b) => b.status === 'W').length, l = settled.filter((b) => b.status === 'L').length, p = settled.filter((b) => b.status === 'P').length;
  const expected = settled.reduce((a, b) => a + b.stake * b.ev, 0);

  const bySport = SPORT_KEYS.map((k) => {
    const bs = settled.filter((b) => b.sport === k);
    return { k: SPORTS[k].name, pnl: bs.reduce((a, b) => a + b.pnl, 0), n: bs.length };
  }).filter((x) => x.n);

  const exportCsv = () => {
    const head = ['placed', 'sport', 'game_date', 'matchup', 'bet', 'book', 'decimal', 'stake', 'p_win', 'ev', 'status', 'pnl', 'clv'];
    const rows = bets.map((b) => [b.placedAt, b.sport, b.gameDate, `"${b.matchup}"`, `"${b.label}"`, b.book, b.decimal.toFixed(3), b.stake, b.pWin.toFixed(4), b.ev.toFixed(4), b.status, b.pnl.toFixed(2), b.clv?.toFixed(4) ?? ''].join(','));
    download('edgelab-bets.csv', [head.join(','), ...rows].join('\n'), 'text/csv');
  };
  const exportJson = () => download('edgelab-bets.json', JSON.stringify(bets, null, 2), 'application/json');
  const importJson = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as TrackedBet[];
      if (!Array.isArray(data)) throw new Error('not an array');
      const ids = new Set(bets.map((b) => b.id));
      set({ bets: [...data.filter((b) => b && b.id && !ids.has(b.id)), ...bets] });
    } catch (e) {
      alert(`Could not import: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bet tracker"
        subtitle="Every tracked bet with its price, model probability, closing line value and result"
        right={
          <>
            <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus size={13} /> Manual bet</Button>
            <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!bets.length}><Download size={13} /> CSV</Button>
            <Button size="sm" variant="ghost" onClick={exportJson} disabled={!bets.length}><Download size={13} /> JSON</Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Upload size={13} /> Import</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Record" value={`${w}-${l}${p ? `-${p}` : ''}`} sub={settled.length ? `${pct(w / Math.max(1, w + l), 1)} win rate` : 'No settled bets'} />
        <Stat label="Profit" value={smoney(profit)} tone={profit >= 0 ? 'pos' : 'neg'} sub={`Expected ${smoney(expected)}`} />
        <Stat label="ROI" value={staked ? spct(profit / staked) : '—'} tone={staked ? (profit >= 0 ? 'pos' : 'neg') : undefined} sub={`${money(staked)} staked`} />
        <Stat label="Avg CLV" value={clvs.length ? spct(clvs.reduce((a, b) => a + b, 0) / clvs.length, 2) : '—'} tone={clvs.length ? (clvs.reduce((a, b) => a + b, 0) >= 0 ? 'pos' : 'neg') : undefined} sub={clvs.length ? `Beat close ${pct(clvs.filter((c) => c > 0).length / clvs.length, 0)}` : 'Settles with closing lines'} />
        <Stat label="At risk" value={money(bank.exposure)} sub={`${bets.filter((b) => b.status === 'open').length} open`} />
      </div>

      {adding && <ManualBet onAdd={(b) => { addBet(b); setAdding(false); }} />}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card pad={false} title={`${list.length} bets`} right={<><Segmented size="sm" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All sports' }, { value: 'sport', label: SPORTS[sport].name }]} /><Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'settled', label: 'Settled' }]} /></>}>
          {list.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="border-y border-line bg-panel-2/50"><tr><Th>Game</Th><Th>Bet</Th><Th right>Odds</Th><Th right>Stake</Th><Th right>Edge</Th><Th right>CLV</Th><Th>Result</Th><Th right>P/L</Th><Th /></tr></thead>
                <tbody>
                  {list.map((b) => (
                    <tr key={b.id} className="border-b border-line/50 last:border-0 hover:bg-panel-2/40">
                      <Td><div className="max-w-[220px] truncate">{b.matchup}</div><div className="text-[10.5px] text-muted">{SPORTS[b.sport].name} · {b.gameDate}</div></Td>
                      <Td><div className="font-medium">{b.label}</div><div className="text-[10.5px] text-muted">{b.book}{b.source === 'manual' ? ' · manual' : b.source === 'live' ? ' · live' : ''}</div></Td>
                      <Td right mono>{odds(b.decimal)}</Td>
                      <Td right mono>{money(b.stake)}</Td>
                      <Td right mono className={b.ev >= 0 ? 'text-pos' : 'text-neg'}>{spct(b.ev)}</Td>
                      <Td right mono className={b.clv === undefined ? 'text-faint' : b.clv >= 0 ? 'text-pos' : 'text-neg'}>{b.clv === undefined ? '—' : spct(b.clv)}</Td>
                      <Td>
                        {b.status === 'open' ? (
                          b.source === 'demo' ? <Badge tone="info">Pending</Badge> : (
                            <div className="flex gap-1">
                              {(['W', 'L', 'P'] as const).map((r) => (
                                <button key={r} onClick={() => updateBet(b.id, { status: r, pnl: r === 'W' ? b.stake * (b.decimal - 1) : r === 'L' ? -b.stake : 0 })} className="h-6 w-6 rounded-md border border-line-2 bg-panel-2 text-[11px] font-semibold hover:bg-panel-3">{r}</button>
                              ))}
                            </div>
                          )
                        ) : <Badge tone={b.status === 'W' ? 'pos' : b.status === 'L' ? 'neg' : 'neutral'}>{b.status === 'W' ? 'Won' : b.status === 'L' ? 'Lost' : 'Push'}</Badge>}
                      </Td>
                      <Td right mono className={clsx(b.pnl > 0 ? 'text-pos' : b.pnl < 0 ? 'text-neg' : 'text-muted')}>{b.status === 'open' ? '—' : smoney(b.pnl, 2)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {b.source !== 'demo' && b.clv === undefined && <ClosePrompt bet={b} onSet={(clv) => updateBet(b.id, { clv })} />}
                          <button onClick={() => removeBet(b.id)} className="rounded p-1 text-faint hover:text-neg" aria-label="Delete"><Trash2 size={13} /></button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty icon={<Receipt size={28} />} title="No bets here yet">Add prices from the odds board to your slip, then track them.</Empty>}
        </Card>
        <Card title="P/L by league">
          {bySport.length ? (
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={bySport} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="2 4" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => money(v)} />
                  <YAxis type="category" dataKey="k" tickLine={false} axisLine={false} width={40} />
                  <Tooltip {...chartTooltip} formatter={(v) => [smoney(Number(v), 2), 'P/L']} />
                  <Bar dataKey="pnl" radius={[0, 3, 3, 0]} isAnimationActive={false}>{bySport.map((x) => <Cell key={x.k} fill={x.pnl >= 0 ? '#34d399' : '#f87171'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="Nothing settled" />}
        </Card>
      </div>
    </div>
  );
}

function ClosePrompt({ bet, onSet }: { bet: TrackedBet; onSet: (clv: number) => void }) {
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState('');
  const [other, setOther] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="rounded border border-line-2 px-1.5 py-0.5 text-[10px] text-muted hover:text-fg">+ close</button>;
  const ok = () => {
    const a = americanToDecimal(Number(mine)), b = americanToDecimal(Number(other));
    if (!isFinite(a) || !isFinite(b)) return;
    const [fair] = devig([a, b], 'shin');
    onSet(bet.decimal * fair - 1);
    setOpen(false);
  };
  return (
    <div className="flex items-center gap-1">
      <input className={`${inputCls} h-6 w-16 px-1.5 text-[11px]`} placeholder="Your side" value={mine} onChange={(e) => setMine(e.target.value)} />
      <input className={`${inputCls} h-6 w-16 px-1.5 text-[11px]`} placeholder="Other" value={other} onChange={(e) => setOther(e.target.value)} />
      <button onClick={ok} className="rounded bg-pos/20 px-1.5 text-[10px] text-pos">ok</button>
    </div>
  );
}

function ManualBet({ onAdd }: { onAdd: (b: TrackedBet) => void }) {
  const sport = useStore((s) => s.sport);
  const [f, setF] = useState({ sport: sport as SportKey, matchup: '', label: '', book: '', american: '-110', stake: '100', prob: '', date: new Date().toISOString().slice(0, 10) });
  const dec = americanToDecimal(Number(f.american));
  const p = f.prob ? Number(f.prob) / 100 : 1 / dec;
  const submit = () => {
    if (!f.label || !isFinite(dec) || !(Number(f.stake) > 0)) return;
    onAdd({
      id: uid(), sport: f.sport, gameId: `manual-${uid()}`, placedAt: new Date().toISOString(), gameDate: f.date, matchup: f.matchup || '—', label: f.label,
      market: 'ml', side: 'home', line: null, book: f.book || 'Manual', decimal: dec, stake: Number(f.stake), pWin: p, ev: p * dec - 1, status: 'open', pnl: 0, source: 'manual',
    });
  };
  return (
    <Card title="Log a bet you placed elsewhere">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="League"><select className={inputCls} value={f.sport} onChange={(e) => setF({ ...f, sport: e.target.value as SportKey })}>{SPORT_KEYS.map((k) => <option key={k} value={k}>{SPORTS[k].name}</option>)}</select></Field>
        <Field label="Matchup"><input className={inputCls} placeholder="Away @ Home" value={f.matchup} onChange={(e) => setF({ ...f, matchup: e.target.value })} /></Field>
        <Field label="Selection"><input className={inputCls} placeholder="e.g. Bills -3.5" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label="Book"><input className={inputCls} placeholder="Sportsbook" value={f.book} onChange={(e) => setF({ ...f, book: e.target.value })} /></Field>
        <Field label="Odds (American)"><input className={inputCls} value={f.american} onChange={(e) => setF({ ...f, american: e.target.value })} /></Field>
        <Field label="Stake ($)"><input className={inputCls} type="number" value={f.stake} onChange={(e) => setF({ ...f, stake: e.target.value })} /></Field>
        <Field label="Your win prob % (optional)"><input className={inputCls} value={f.prob} onChange={(e) => setF({ ...f, prob: e.target.value })} /></Field>
        <Field label="Game date"><input className={inputCls} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-end"><Button variant="primary" onClick={submit}>Add bet</Button></div>
    </Card>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
