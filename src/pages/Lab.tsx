import clsx from 'clsx';
import { FlaskConical, Info, RotateCcw } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useEng } from '../components/EngineContext';
import { Badge, Button, Card, chartTooltip, Empty, PageHeader, Segmented, Slider, Stat, Td, Th, Toggle } from '../components/ui';
import { DEFAULT_BT } from '../lib/backtest';
import { money, num, pct, smoney, spct, useOdds } from '../lib/format';
import { DEFAULT_PARAMS } from '../lib/model/ratings';
import { SPORTS } from '../lib/sports';
import { useStore } from '../lib/store';
import { useBacktest } from '../lib/useBacktest';

export default function Lab() {
  const eng = useEng();
  const cfg = SPORTS[eng.sport];
  const { params, setParams, bt, setBt, set } = useStore();
  const odds = useOdds();
  const [span, setSpan] = useState<'current' | 'two' | 'all'>('two');
  const allSeasons = useMemo(() => [...new Set(eng.games.map((g) => g.season))].sort(), [eng.games]);
  const seasons = useMemo(() => (span === 'current' ? allSeasons.slice(-1) : span === 'two' ? allSeasons.slice(-2) : allSeasons), [span, allSeasons]);
  const cfgBt = useMemo(() => ({ ...bt, weight: params.marketWeight }), [bt, params.marketWeight]);
  const deferred = useDeferredValue(cfgBt);
  const res = useBacktest(deferred, seasons);
  const stale = deferred !== cfgBt;
  const clvHist = useMemo(() => histogram((res?.bets ?? []).map((b) => b.clv * 100)), [res]);

  if (eng.mode !== 'demo' || !res) {
    return <><PageHeader title="Model lab" /><Card><Empty icon={<FlaskConical size={28} />} title="Backtesting runs on the simulated league">Switch data source to the simulator in Settings. Live odds have no settled history to test against.</Empty></Card></>;
  }
  const s = res.summary;
  const calib = (['model', 'market', 'blend'] as const).map((k) => res.calibration[k].map((b) => ({ x: b.predicted * 100, [k]: b.observed * 100, n: b.n })));
  const hfaDefault = cfg.hfa;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Model lab"
        subtitle={`Walk-forward backtest on ${seasons.join(', ')} ${cfg.name} · every prediction made before the game, with only information available at the time`}
        right={<Button size="sm" variant="ghost" onClick={() => set({ params: DEFAULT_PARAMS, bt: DEFAULT_BT })}><RotateCcw size={13} /> Defaults</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Rating model">
            <div className="space-y-4">
              <Slider label="Model weight vs market" min={0} max={1} step={0.05} value={params.marketWeight} onChange={(v) => setParams({ marketWeight: v })} format={(v) => `${Math.round(v * 100)}%`} hint="0% = pure de-vigged market (line shopping only). 100% = trust the model fully." />
              <Slider label="Rating volatility" min={0.25} max={3} step={0.05} value={params.volatility} onChange={(v) => setParams({ volatility: v })} format={(v) => `${v.toFixed(2)}×`} hint="Process noise: how fast the filter believes true team strength moves." />
              <Slider label="Season regression" min={0} max={0.8} step={0.01} value={params.seasonRegression} onChange={(v) => setParams({ seasonRegression: v })} format={(v) => pct(v, 0)} />
              <Slider label="Observation noise" min={0.5} max={2.5} step={0.05} value={params.noiseScale} onChange={(v) => setParams({ noiseScale: v })} format={(v) => `${v.toFixed(2)}×`} hint="Higher = trust each single result less." />
              <Slider label="Home advantage" min={0} max={hfaDefault * 2.5} step={hfaDefault / 20} value={params.hfa ?? hfaDefault} onChange={(v) => setParams({ hfa: v })} format={(v) => num(v, cfg.scoreModel === 'margin' ? 1 : 3)} />
              {cfg.b2bPenalty > 0 && <Toggle checked={params.useRest} onChange={(v) => setParams({ useRest: v })} label="Rest / back-to-back adjustment" />}
            </div>
          </Card>
          <Card title="Betting strategy">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs"><span className="text-fg-2">Bet into</span><Segmented size="sm" value={bt.timing} onChange={(v) => setBt({ timing: v })} options={[{ value: 'open', label: 'Openers' }, { value: 'close', label: 'Closing' }]} /></div>
              <Slider label="Min edge" min={0} max={0.12} step={0.0025} value={bt.minEdge} onChange={(v) => setBt({ minEdge: v })} format={(v) => pct(v)} />
              <div className="flex items-center justify-between text-xs"><span className="text-fg-2">Staking</span><Segmented size="sm" value={bt.staking} onChange={(v) => setBt({ staking: v })} options={[{ value: 'kelly', label: 'Kelly' }, { value: 'flat', label: 'Flat' }]} /></div>
              {bt.staking === 'kelly' ? (
                <>
                  <Slider label="Kelly fraction" min={0.05} max={1} step={0.05} value={bt.kellyFraction} onChange={(v) => setBt({ kellyFraction: v })} format={(v) => `${Math.round(v * 100)}%`} />
                  <Slider label="Max stake" min={0.005} max={0.1} step={0.005} value={bt.maxStakePct} onChange={(v) => setBt({ maxStakePct: v })} format={(v) => pct(v)} />
                </>
              ) : <Slider label="Flat stake" min={0.0025} max={0.05} step={0.0025} value={bt.flatPct} onChange={(v) => setBt({ flatPct: v })} format={(v) => pct(v, 2)} />}
              <Slider label="Max model/market gap" min={0.02} max={0.3} step={0.01} value={bt.maxDisagreement} onChange={(v) => setBt({ maxDisagreement: v })} format={(v) => (v >= 0.3 ? 'off' : pct(v, 0))} hint="Skip bets where the model's probability differs from the de-vigged market by more than this. Huge gaps are usually information the model lacks (injuries, lineup news)." />
              <Slider label="Skip until N games played" min={0} max={cfg.dayStep === 7 ? 8 : 20} step={1} value={bt.minGames} onChange={(v) => setBt({ minGames: v })} />
              <div className="flex flex-wrap gap-3">
                {(['ml', 'spread', 'total'] as const).map((m) => <Toggle key={m} checked={bt.markets[m]} onChange={(v) => setBt({ markets: { ...bt.markets, [m]: v } })} label={m === 'ml' ? 'Moneyline' : m === 'spread' ? cfg.spreadName : 'Totals'} />)}
              </div>
              <div className="flex items-center justify-between text-xs"><span className="text-fg-2">De-vig</span><Segmented size="sm" value={bt.devig} onChange={(v) => setBt({ devig: v })} options={[{ value: 'shin', label: 'Shin' }, { value: 'power', label: 'Power' }, { value: 'multiplicative', label: 'Mult' }]} /></div>
              <div className="flex items-center justify-between text-xs"><span className="text-fg-2">Seasons</span><Segmented size="sm" value={span} onChange={setSpan} options={[{ value: 'current', label: 'Current' }, { value: 'two', label: 'Last 2' }, { value: 'all', label: 'All' }]} /></div>
            </div>
          </Card>
        </div>

        <div className={clsx('space-y-4 transition-opacity', stale && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="ROI (yield)" value={spct(s.roi)} tone={s.roi >= 0 ? 'pos' : 'neg'} sub={`${s.won}-${s.lost}-${s.pushed} · ${s.n.toLocaleString()} bets`} />
            <Stat label="Bankroll growth" value={spct(s.growth, 0)} tone={s.growth >= 0 ? 'pos' : 'neg'} sub={`${smoney(s.profit)} on ${money(s.staked)} staked`} />
            <Stat label="Avg CLV" value={spct(s.avgClv, 2)} tone={s.avgClv >= 0 ? 'pos' : 'neg'} sub={`Beat close ${pct(s.beatClose, 0)} of the time`} />
            <Stat label="Max drawdown" value={pct(s.maxDd, 0)} tone={s.maxDd > 0.3 ? 'neg' : s.maxDd > 0.15 ? 'warn' : undefined} sub={`Sharpe ${num(s.sharpe, 2)} · avg ${odds(s.avgOdds)}`} />
          </div>

          {s.n > 0 && (
            <div className={clsx('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs', s.avgEdge > s.roi + 0.03 ? 'border-warn/25 bg-warn/[0.06]' : 'border-pos/25 bg-pos/[0.06]')}>
              <Info size={14} className={clsx('mt-0.5 shrink-0', s.avgEdge > s.roi + 0.03 ? 'text-warn' : 'text-pos')} />
              <div className="text-fg-2">
                Claimed edge averaged <b className="num text-fg">{spct(s.avgEdge)}</b> vs realised ROI <b className="num text-fg">{spct(s.roi)}</b> and CLV <b className="num text-fg">{spct(s.avgClv)}</b>.{' '}
                {s.avgEdge > s.roi + 0.03
                  ? 'The gap is the winner\'s curse: the biggest "edges" are disproportionately model error. Lower the model weight or raise the threshold.'
                  : 'Claimed and realised edge line up — the model is well calibrated at this setting.'}
                {' '}CLV is the low-variance signal: positive CLV over hundreds of bets is the strongest evidence of real skill.
              </div>
            </div>
          )}

          <Card title="Equity curve" subtitle={`Start ${money(bt.startBankroll)} · compounding by game-day`}>
            <div className="h-[260px]">
              {res.equity.length ? (
                <ResponsiveContainer>
                  <AreaChart data={res.equity} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                    <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.growth >= 0 ? '#34d399' : '#f87171'} stopOpacity={0.3} /><stop offset="100%" stopColor={s.growth >= 0 ? '#34d399' : '#f87171'} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={50} tickFormatter={(d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} />
                    <YAxis tickLine={false} axisLine={false} width={68} tickFormatter={(v) => money(v)} domain={['auto', 'auto']} />
                    <ReferenceLine y={bt.startBankroll} stroke="#4f5b6b" strokeDasharray="4 3" />
                    <Tooltip {...chartTooltip} formatter={(v) => [money(Number(v), 2), 'Bankroll']} />
                    <Area type="monotone" dataKey="bankroll" stroke={s.growth >= 0 ? '#34d399' : '#f87171'} strokeWidth={1.75} fill="url(#eq)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty title="No bets" />}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Calibration" subtitle="Predicted vs observed home-win rate (decided games)">
              <div className="h-[250px]">
                <ResponsiveContainer>
                  <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                    <CartesianGrid strokeDasharray="2 4" />
                    <XAxis type="number" dataKey="x" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={48} />
                    <Tooltip {...chartTooltip} formatter={(v, n) => [`${Number(v).toFixed(1)}%`, String(n)]} labelFormatter={(l) => `Predicted ${Number(l).toFixed(1)}%`} />
                    <Line data={[{ x: 0, d: 0 }, { x: 100, d: 100 }]} dataKey="d" stroke="#4f5b6b" strokeDasharray="4 3" dot={false} isAnimationActive={false} legendType="none" name="Perfect" />
                    <Scatter data={calib[1]} dataKey="market" fill="#7c8a9c" name="Market" line={{ stroke: '#7c8a9c', strokeWidth: 1 }} isAnimationActive={false} />
                    <Scatter data={calib[0]} dataKey="model" fill="#60a5fa" name="Model" line={{ stroke: '#60a5fa', strokeWidth: 1 }} isAnimationActive={false} />
                    <Scatter data={calib[2]} dataKey="blend" fill="#34d399" name="Blend" line={{ stroke: '#34d399', strokeWidth: 1.5 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-info" />Model</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-muted" />Closing market</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-pos" />Blend</span></div>
            </Card>
            <Card title="Forecast accuracy" subtitle={`${res.scores.n.toLocaleString()} games · lower is better`} pad={false}>
              <table className="w-full text-[12.5px]">
                <thead className="border-y border-line bg-panel-2/50"><tr><Th>Source</Th><Th right>Brier</Th><Th right>Log loss</Th><Th right>vs market</Th></tr></thead>
                <tbody>
                  {(['model', 'market', 'blend'] as const).map((k) => {
                    const d = res.scores[k].brier - res.scores.market.brier;
                    return (
                      <tr key={k} className="border-b border-line/50">
                        <Td className="capitalize">{k === 'market' ? 'Closing market' : k}</Td>
                        <Td right mono>{num(res.scores[k].brier, 4)}</Td>
                        <Td right mono>{num(res.scores[k].logloss, 4)}</Td>
                        <Td right>{k === 'market' ? <Badge>baseline</Badge> : <Badge tone={d <= 0 ? 'pos' : 'neg'} className="num">{d > 0 ? '+' : ''}{d.toFixed(4)}</Badge>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="space-y-3 p-4 sm:p-5">
                <div className="flex justify-between text-xs"><span className="text-fg-2">Margin MAE · model</span><span className="num">{num(res.mae.model, 2)} {cfg.scoreUnit}</span></div>
                <div className="flex justify-between text-xs"><span className="text-fg-2">Margin MAE · closing line</span><span className="num">{num(res.mae.market, 2)} {cfg.scoreUnit}</span></div>
                <div className="h-[110px]">
                  <ResponsiveContainer>
                    <BarChart data={res.byMarket} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                      <CartesianGrid vertical={false} strokeDasharray="2 4" />
                      <XAxis dataKey="market" tickLine={false} axisLine={false} tickFormatter={(m) => (m === 'ml' ? 'ML' : m === 'spread' ? 'Spread' : 'Total')} />
                      <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                      <ReferenceLine y={0} stroke="#4f5b6b" />
                      <Tooltip {...chartTooltip} formatter={(v, n) => [spct(Number(v)), n === 'roi' ? 'ROI' : 'CLV']} />
                      <Bar dataKey="roi" radius={[3, 3, 0, 0]} isAnimationActive={false}>{res.byMarket.map((m) => <Cell key={m.market} fill={m.roi >= 0 ? '#34d399' : '#f87171'} />)}</Bar>
                      <Bar dataKey="clv" fill="#60a5fa" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="CLV distribution" subtitle="Price obtained vs no-vig closing price">
              <div className="h-[200px]">
                <ResponsiveContainer>
                  <BarChart data={clvHist} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="x" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis tickLine={false} axisLine={false} width={48} />
                    <Tooltip {...chartTooltip} formatter={(v) => [v, 'Bets']} labelFormatter={(l) => `CLV ${l}% to ${Number(l) + 2}%`} />
                    <Bar dataKey="n" radius={[2, 2, 0, 0]} isAnimationActive={false}>{clvHist.map((h) => <Cell key={h.x} fill={h.x >= 0 ? '#34d399' : '#f87171'} fillOpacity={0.8} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Recent bets" pad={false}>
              <div className="max-h-[248px] overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 border-y border-line bg-panel-2"><tr><Th>Date</Th><Th>Bet</Th><Th right>Odds</Th><Th right>CLV</Th><Th right>P/L</Th></tr></thead>
                  <tbody>
                    {res.bets.slice(-60).reverse().map((b, i) => (
                      <tr key={i} className="border-b border-line/40">
                        <Td mono className="text-muted">{b.date.slice(5)}</Td>
                        <Td><span className="font-medium">{b.label}</span> <span className="text-faint">{b.book}</span></Td>
                        <Td right mono>{odds(b.decimal)}</Td>
                        <Td right mono className={b.clv >= 0 ? 'text-pos' : 'text-neg'}>{spct(b.clv)}</Td>
                        <Td right mono className={b.pnl > 0 ? 'text-pos' : b.pnl < 0 ? 'text-neg' : 'text-muted'}>{smoney(b.pnl)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function histogram(xs: number[]) {
  const bins = new Map<number, number>();
  for (const x of xs) {
    const b = Math.max(-12, Math.min(12, Math.floor(x / 2) * 2));
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  const out = [];
  for (let b = -12; b <= 12; b += 2) out.push({ x: b, n: bins.get(b) ?? 0 });
  return out;
}
