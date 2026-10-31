import { ArrowRight, Brain, Plus, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useBankroll } from '../components/BetSlip';
import { useEng } from '../components/EngineContext';
import { useAddToSlip } from '../components/Price';
import { Button, Card, chartTooltip, Empty, EvBadge, PageHeader, Stat, TeamChip } from '../components/ui';
import { selectionLabel, type Evaluation } from '../lib/analysis';
import { disagreement } from '../lib/backtest';
import { money, num, pct, smoney, snum, spct, useOdds } from '../lib/format';
import { SPORTS } from '../lib/sports';
import { useStore } from '../lib/store';
import type { Game } from '../lib/types';
import { useBacktest } from '../lib/useBacktest';

export default function Overview() {
  const eng = useEng();
  const cfg = SPORTS[eng.sport];
  const { minEdge, go, bets, bt, params } = useStore();
  const odds = useOdds();
  const add = useAddToSlip();
  const bank = useBankroll();

  const edges = useMemo(() => {
    const out: { g: Game; e: Evaluation }[] = [];
    for (const g of eng.slate) {
      if (g.result) continue;
      for (const e of eng.best.get(g.id) ?? []) if (e.ev >= minEdge && disagreement(e) <= bt.maxDisagreement) out.push({ g, e });
    }
    return out.sort((a, b) => b.e.ev - a.e.ev);
  }, [eng, minEdge, bt.maxDisagreement]);

  const btCfg = useMemo(() => ({ ...bt, weight: params.marketWeight }), [bt, params.marketWeight]);
  const seasons = useMemo(() => {
    const s = [...new Set(eng.games.map((g) => g.season))].sort();
    return s.slice(-2);
  }, [eng.games]);
  const res = useBacktest(btCfg, seasons);

  const settled = bets.filter((b) => b.status !== 'open').sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  const staked = settled.reduce((a, b) => a + b.stake, 0);
  const clvBets = settled.filter((b) => b.clv !== undefined);
  const curve = settled.reduce<{ i: number; bankroll: number; date: string }[]>((acc, b, i) => {
    acc.push({ i: i + 1, date: b.gameDate, bankroll: (acc[acc.length - 1]?.bankroll ?? bank.start) + b.pnl });
    return acc;
  }, [{ i: 0, date: '', bankroll: bank.start }]);

  const top = eng.model.ranked().slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        subtitle={`${cfg.league} · ${eng.todayLabel} · ${eng.slate.length} games on the slate`}
        right={<Button variant="primary" onClick={() => go('board')}>Open board <ArrowRight size={14} /></Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Bankroll" value={money(bank.current)} sub={<span className={bank.pnl >= 0 ? 'text-pos' : 'text-neg'}>{smoney(bank.pnl)} all-time</span>} />
        <Stat label="Tracked ROI" value={staked ? spct(settled.reduce((a, b) => a + b.pnl, 0) / staked) : '—'} tone={staked ? (settled.reduce((a, b) => a + b.pnl, 0) >= 0 ? 'pos' : 'neg') : undefined} sub={`${settled.length} settled bets`} />
        <Stat label="Avg CLV" value={clvBets.length ? spct(clvBets.reduce((a, b) => a + b.clv!, 0) / clvBets.length) : '—'} tone={clvBets.length ? (clvBets.reduce((a, b) => a + b.clv!, 0) >= 0 ? 'pos' : 'neg') : undefined} sub="The best predictor of long-run profit" hint="Closing line value: how much better your price was than the no-vig closing price." />
        <Stat label="Open exposure" value={money(bank.exposure)} sub={`${bets.filter((b) => b.status === 'open').length} open bets`} />
        <Stat label="+EV prices" value={edges.length} tone={edges.length ? 'pos' : undefined} sub={`≥ ${pct(minEdge)} edge today`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-1.5"><Sparkles size={14} className="text-pos" /> Top edges on the slate</span>}
          subtitle={`Best price per selection, ranked by EV vs the blended probability · excludes model/market gaps over ${pct(bt.maxDisagreement, 0)}`}
          right={edges.length > 0 && <Button size="sm" onClick={() => edges.slice(0, 10).forEach(({ g, e }) => add(g, e, g.live ? 'live' : 'demo'))}><Plus size={13} /> Add top {Math.min(10, edges.length)}</Button>}
          pad={false}
        >
          {edges.length ? (
            <div className="divide-y divide-line/70">
              {edges.slice(0, 9).map(({ g, e }) => (
                <div key={`${g.id}${e.market}${e.side}`} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-panel-2/60 sm:px-5" onClick={() => go('game', g.id)}>
                  <div className="flex -space-x-1.5"><TeamChip sport={g.sport} name={g.away} size="sm" /><TeamChip sport={g.sport} name={g.home} size="sm" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{selectionLabel(g, e.market, e.side, e.line, false)}</div>
                    <div className="truncate text-[11px] text-muted">{g.away} @ {g.home} · {e.book}</div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="text-[10px] uppercase tracking-wider text-muted">Fair</div>
                    <div className="num text-xs text-fg-2">{pct(e.blend.win / Math.max(1e-9, 1 - e.blend.push))}</div>
                  </div>
                  <div className="num w-14 text-right text-[13px] font-semibold">{odds(e.decimal)}</div>
                  <EvBadge ev={e.ev} />
                  <button onClick={(ev) => { ev.stopPropagation(); add(g, e, g.live ? 'live' : 'demo'); }} className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-pos" aria-label="Add"><Plus size={15} /></button>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<Sparkles size={26} />} title="Nothing clears your threshold">Efficient markets are the norm. Sim to the next slate, or adjust the edge threshold in Settings.</Empty>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><Brain size={14} className="text-violet" /> Model health</span>} subtitle={res ? `Walk-forward, ${seasons.join(' & ')} seasons to date` : 'Backtests run on the simulated league'} right={<Button size="sm" variant="ghost" onClick={() => go('lab')}>Lab <ArrowRight size={12} /></Button>}>
          {res ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {(['model', 'market', 'blend'] as const).map((k) => (
                  <div key={k} className="rounded-xl bg-panel-2 px-2 py-2.5 ring-1 ring-line">
                    <div className="text-[10px] uppercase tracking-wider text-muted">{k}</div>
                    <div className="num mt-1 text-sm font-semibold">{num(res.scores[k].brier, 4)}</div>
                    <div className="text-[10px] text-faint">Brier</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between"><span className="text-fg-2">Strategy ROI</span><span className={`num ${res.summary.roi >= 0 ? 'text-pos' : 'text-neg'}`}>{spct(res.summary.roi)}</span></div>
                <div className="flex justify-between"><span className="text-fg-2">Avg CLV</span><span className={`num ${res.summary.avgClv >= 0 ? 'text-pos' : 'text-neg'}`}>{spct(res.summary.avgClv)}</span></div>
                <div className="flex justify-between"><span className="text-fg-2">Beat the close</span><span className="num">{pct(res.summary.beatClose, 0)}</span></div>
                <div className="flex justify-between"><span className="text-fg-2">Bets</span><span className="num">{res.summary.n.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-fg-2">Margin MAE (model / close)</span><span className="num">{num(res.mae.model, 2)} / {num(res.mae.market, 2)}</span></div>
              </div>
            </div>
          ) : <Empty title="Live mode">Switch to the simulated league to backtest.</Empty>}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Bankroll" subtitle="Tracked bets, settled">
          {settled.length ? (
            <div className="h-[220px]">
              <ResponsiveContainer>
                <AreaChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <defs><linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="i" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => money(v)} domain={['auto', 'auto']} />
                  <Tooltip {...chartTooltip} formatter={(v) => [money(Number(v), 2), 'Bankroll']} labelFormatter={(l) => `Bet #${l}`} />
                  <Area type="linear" dataKey="bankroll" stroke="#34d399" strokeWidth={2} fill="url(#bk)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No settled bets yet">Add a few edges to your slip, track them, then hit <b>Sim day</b> to play the games and watch CLV and P/L roll in.</Empty>
          )}
        </Card>
        <Card title="Power ratings" subtitle={cfg.scoreModel === 'margin' ? 'Points vs average team, neutral site' : 'Goals/runs per game vs average'} right={<Button size="sm" variant="ghost" onClick={() => go('ratings')}>All <ArrowRight size={12} /></Button>}>
          {eng.hasModel && top.length ? (
            <div className="space-y-2">
              {top.map((t, i) => (
                <div key={t.team} className="flex items-center gap-2.5">
                  <span className="num w-4 text-[11px] text-faint">{i + 1}</span>
                  <TeamChip sport={eng.sport} name={t.team} size="sm" />
                  <span className="flex-1 truncate text-[12.5px]">{t.team}</span>
                  <span className="num text-[11px] text-muted">{t.w}-{t.l}{t.t ? `-${t.t}` : ''}</span>
                  <span className="num w-12 text-right text-[12.5px] font-medium text-pos">{snum(t.net, cfg.scoreModel === 'margin' ? 1 : 2)}</span>
                </div>
              ))}
            </div>
          ) : <Empty title="No ratings">Import results in Settings.</Empty>}
        </Card>
      </div>

      <Card title="How EdgeLab prices a game">
        <div className="grid gap-3 text-[12.5px] sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['1 · Ratings', 'Offense/defense ratings per team, updated after every game by a Kalman filter (linear for points, extended/Poisson for goals). Uncertainty grows between games and regresses between seasons.'],
            ['2 · Projection', 'Expected score for each side from ratings, home edge, rest/back-to-backs and your manual adjustments.'],
            ['3 · Distribution', cfg.scoreModel === 'margin' ? 'Full margin & total distribution — discretised normal reshaped to the sport\'s key numbers, with overtime resolution.' : 'Exact-score grid from Poisson / negative-binomial marginals with a Dixon–Coles low-score correction, extra time resolved.'],
            ['4 · Market blend', 'The sharp line is de-vigged (Shin by default) and blended with the model in log-odds space — the market is usually right; the model only nudges it.'],
            ['5 · Bet sizing', 'Every price at every book gets an EV and a push-aware Kelly stake. Closing line value is tracked on every bet.'],
          ].map(([h, b]) => (
            <div key={h} className="rounded-xl bg-panel-2/70 p-3.5 ring-1 ring-line">
              <div className="mb-1 font-semibold text-fg">{h}</div>
              <div className="leading-relaxed text-muted">{b}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
