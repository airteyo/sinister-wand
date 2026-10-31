import clsx from 'clsx';
import { ArrowLeft, Plus, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useEng } from '../components/EngineContext';
import { PriceButton, useAddToSlip } from '../components/Price';
import { Badge, Button, Card, chartTooltip, Empty, EvBadge, Segmented, Slider, Stat, TeamChip, Td, teamInfo, Th } from '../components/ui';
import { selectionLabel, type Evaluation } from '../lib/analysis';
import { lineTicks } from '../lib/data/generate';
import { num, pct, snum, useOdds } from '../lib/format';
import { fairFromSnap } from '../lib/model/market';
import { fairSpread, fairTotal, spreadTriple, totalTriple } from '../lib/model/pricing';
import { fmtLine } from '../lib/odds';
import { SPORTS, type SportKey } from '../lib/sports';
import { useStore } from '../lib/store';
import type { TeamRating } from '../lib/types';

export default function GameView() {
  const eng = useEng();
  const { gameId, go, adjustments, setAdj } = useStore();
  const odds = useOdds();
  const add = useAddToSlip();
  const [distMode, setDistMode] = useState<'margin' | 'total'>('margin');
  const g = gameId ? eng.gameById.get(gameId) : undefined;
  const cfg = SPORTS[eng.sport];
  const dist = g ? eng.dists.get(g.id) : undefined;
  const pred = g ? eng.preds.get(g.id) : undefined;
  const evals = g ? eng.evals.get(g.id) ?? [] : [];
  const best = g ? eng.best.get(g.id) ?? [] : [];
  const sharp = g?.books.find((b) => b.book === 'Sharp')?.current;
  const fair = sharp ? fairFromSnap(sharp) : null;
  const adj = g ? adjustments[g.id] ?? { home: 0, away: 0, total: 0 } : { home: 0, away: 0, total: 0 };

  const ticks = useMemo(() => (g && !g.live ? lineTicks(g, g.day < eng.today ? 1 : g.day === eng.today ? 0.6 : 0) : []), [g, eng.today]);

  const curve = useMemo(() => {
    if (!dist || !sharp || !fair || !isFinite(sharp.spread)) return [];
    const center = Math.round(fairSpread(dist));
    const step = cfg.scoreModel === 'count' && !cfg.threeWay ? 1 : 0.5;
    const span = cfg.scoreModel === 'margin' ? 14 : 3;
    const cond = (l: number) => { const t = spreadTriple(dist, l); return t.win / Math.max(1e-9, t.win + t.loss); };
    const out = [];
    for (let l = center - span; l <= center + span; l += step) {
      const m = cond(l);
      out.push({ line: l, model: m * 100, market: Math.min(99.9, Math.max(0.1, (fair.spread[0] + m - cond(sharp.spread)) * 100)) });
    }
    return out;
  }, [dist, sharp, fair, cfg]);

  if (!g || !dist || !pred) {
    return <Card><Empty title="Game not found">Pick a game from the odds board.</Empty><div className="flex justify-center pb-6"><Button onClick={() => go('board')}>Back to board</Button></div></Card>;
  }

  const hr = eng.model.teams.get(g.home), ar = eng.model.teams.get(g.away);
  const marketLine = sharp && isFinite(sharp.spread) ? sharp.spread : NaN;
  const totalLine = sharp && isFinite(sharp.total) ? sharp.total : NaN;
  const distData = (distMode === 'margin' ? dist.margin : dist.total).values
    .map((v, i) => ({ v, p: (distMode === 'margin' ? dist.margin : dist.total).probs[i] * 100 }))
    .filter((d) => d.p > 0.05);
  const coverColor = (v: number) => {
    if (distMode === 'margin') {
      if (!isFinite(marketLine)) return v > 0 ? '#34d399' : '#60a5fa';
      const x = v + marketLine;
      return x > 0 ? '#34d399' : x < 0 ? '#60a5fa' : '#fbbf24';
    }
    if (!isFinite(totalLine)) return '#a78bfa';
    return v > totalLine ? '#a78bfa' : v < totalLine ? '#475569' : '#fbbf24';
  };
  const st = isFinite(marketLine) ? spreadTriple(dist, marketLine) : null;
  const tt = isFinite(totalLine) ? totalTriple(dist, totalLine) : null;
  const unit = cfg.scoreUnit;
  const ranked = [...best].sort((a, b) => b.ev - a.ev);
  const source = g.live ? 'live' : 'demo';
  const mlRows = cfg.threeWay
    ? [{ k: 'Home', model: dist.pHome, mkt: fair?.ml[0] }, { k: 'Draw', model: dist.pDraw, mkt: fair?.ml[2] }, { k: 'Away', model: dist.pAway, mkt: fair?.ml[1] }]
    : [{ k: g.home, model: dist.pHome, mkt: fair?.ml[0] }, { k: g.away, model: dist.pAway, mkt: fair?.ml[1] }];
  const blendFor = (side: Evaluation['side']) => evals.find((e) => e.market === 'ml' && e.side === side)?.blend.win;

  return (
    <div className="space-y-4">
      <button onClick={() => go('board')} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ArrowLeft size={14} /> Odds board</button>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ background: `linear-gradient(100deg, ${teamColor(g.sport, g.away)} 0%, transparent 40%, transparent 60%, ${teamColor(g.sport, g.home)} 100%)` }} />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <TeamSide sport={g.sport} name={g.away} rec={ar} label="Away" netFmt={cfg.scoreModel === 'margin' ? 1 : 2} />
          <div className="order-first w-full text-center sm:order-none sm:w-auto">
            {g.result ? (
              <div className="num text-3xl font-semibold">{g.result.away} – {g.result.home}</div>
            ) : (
              <div className="num text-2xl font-semibold text-fg-2">{num(dist.muAway, 1)} – {num(dist.muHome, 1)}</div>
            )}
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">{g.result ? 'Final' : 'Projected score'}</div>
            <div className="mt-2 text-xs text-muted">{g.commence ? new Date(g.commence).toLocaleString() : new Date(g.date + 'T12:00:00').toDateString()}</div>
          </div>
          <TeamSide sport={g.sport} name={g.home} rec={hr} label="Home" right netFmt={cfg.scoreModel === 'margin' ? 1 : 2} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${g.home.split(' ').pop()} win`} value={pct(dist.pHome)} sub={fair ? `Market ${pct(fair.ml[0])}` : undefined} />
        <Stat label={`Fair ${cfg.spreadName.toLowerCase()}`} value={fmtLine(Math.round(fairSpread(dist) * 10) / 10)} sub={isFinite(marketLine) ? `Market ${fmtLine(marketLine)} · cover ${pct(st!.win / (st!.win + st!.loss))}` : undefined} />
        <Stat label="Fair total" value={num(fairTotal(dist), 1)} sub={isFinite(totalLine) ? `Market ${totalLine} · over ${pct(tt!.win / (tt!.win + tt!.loss))}` : undefined} />
        <Stat label="Best edge" value={ranked[0] ? `${ranked[0].ev > 0 ? '+' : ''}${(ranked[0].ev * 100).toFixed(1)}%` : '—'} tone={ranked[0]?.ev > 0.02 ? 'pos' : undefined} sub={ranked[0] ? `${selectionLabel(g, ranked[0].market, ranked[0].side, ranked[0].line)} ${odds(ranked[0].decimal)} @ ${ranked[0].book}` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card
            title="Outcome distribution"
            subtitle={distMode === 'margin' ? `Final ${g.home.split(' ').pop()} margin (${unit}) after ${cfg.threeWay ? 'full time' : 'OT / extras'}. Green covers the market line, amber pushes.` : `Combined ${unit}. Violet = over the market total.`}
            right={<Segmented size="sm" value={distMode} onChange={setDistMode} options={[{ value: 'margin', label: 'Margin' }, { value: 'total', label: 'Total' }]} />}
          >
            <div className="h-[240px]">
              <ResponsiveContainer>
                <BarChart data={distData} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="v" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={48} />
                  <Tooltip {...chartTooltip} formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Probability']} labelFormatter={(l) => (distMode === 'margin' ? `Home by ${l}` : `Total ${l}`)} />
                  {distMode === 'margin' && isFinite(marketLine) && <ReferenceLine x={-marketLine} stroke="#fbbf24" strokeDasharray="4 3" />}
                  <Bar dataKey="p" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {distData.map((d) => <Cell key={d.v} fill={coverColor(d.v)} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {cfg.keyNumbers && distMode === 'margin' && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">Key numbers:
                {[3, 7, 10, 14].map((k) => {
                  const p = dist.margin.values.reduce((a, v, i) => a + (Math.abs(v) === k ? dist.margin.probs[i] : 0), 0);
                  return <Badge key={k}>±{k}: <span className="num">{pct(p)}</span></Badge>;
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Alt-line cover curve" subtitle={`P(${g.home.split(' ').pop()} covers) at every handicap`}>
              <div className="h-[210px]">
                <ResponsiveContainer>
                  <LineChart data={curve} margin={{ top: 6, right: 8, bottom: 0, left: -4 }}>
                    <CartesianGrid strokeDasharray="2 4" />
                    <XAxis dataKey="line" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false} tickFormatter={(v) => fmtLine(v)} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={48} />
                    <Tooltip {...chartTooltip} formatter={(v, n) => [`${Number(v).toFixed(1)}%`, n === 'model' ? 'Model' : 'Market']} labelFormatter={(l) => `Home ${fmtLine(Number(l))}`} />
                    <ReferenceLine y={50} stroke="#253041" />
                    {isFinite(marketLine) && <ReferenceLine x={marketLine} stroke="#fbbf24" strokeDasharray="4 3" />}
                    <Line type="monotone" dataKey="market" stroke="#7c8a9c" strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
                    <Line type="monotone" dataKey="model" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Line movement" subtitle={g.live ? 'Not available for live feed' : 'Sharp consensus, open → now'}>
              {ticks.length ? (
                <div className="h-[210px]">
                  <ResponsiveContainer>
                    <LineChart data={ticks.map((t) => ({ ...t, ph: t.pHome * 100 }))} margin={{ top: 6, right: 0, bottom: 0, left: -4 }}>
                      <CartesianGrid strokeDasharray="2 4" />
                      <XAxis dataKey="t" tickLine={false} axisLine={false} tickFormatter={(v) => (v === 0 ? 'Open' : `${Math.round(v * 100)}%`)} />
                      <YAxis yAxisId="l" tickLine={false} axisLine={false} width={48} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v) => fmtLine(Math.round(v * 2) / 2)} />
                      <YAxis yAxisId="r" orientation="right" hide domain={['dataMin - 3', 'dataMax + 3']} />
                      <Tooltip {...chartTooltip} formatter={(v, n) => (n === 'ph' ? [`${Number(v).toFixed(1)}%`, 'Home win (no-vig)'] : [fmtLine(Number(v)), cfg.spreadName])} labelFormatter={(l) => (Number(l) === 0 ? 'Open' : `${Math.round(Number(l) * 100)}% of the way to close`)} />
                      <Line yAxisId="l" type="stepAfter" dataKey="spread" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line yAxisId="r" type="monotone" dataKey="ph" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty title="No line history" />}
            </Card>
          </div>

          <Card title="Book-by-book" subtitle="Every price on the board, with edge vs the blended fair probability. Click to add." pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="border-y border-line bg-panel-2/50">
                  <tr><Th>Book</Th><Th>{cfg.spreadName}</Th><Th>Total</Th><Th>{cfg.threeWay ? '1 × 2' : 'Moneyline'}</Th></tr>
                </thead>
                <tbody>
                  {g.books.filter((b) => !b.reference).map((b) => {
                    const pick = (m: Evaluation['market'], s: Evaluation['side']) => evals.find((e) => e.book === b.book && e.market === m && e.side === s);
                    return (
                      <tr key={b.book} className="border-b border-line/60 last:border-0">
                        <Td className="font-medium">{b.book}{b.book === 'Sharp' && <Badge tone="info" className="ml-1.5">ref</Badge>}</Td>
                        <Td><div className="grid min-w-[190px] grid-cols-2 gap-1.5"><PriceButton compact g={g} e={pick('spread', 'away')} line={pick('spread', 'away') ? fmtLine(pick('spread', 'away')!.line!) : ''} source={source} /><PriceButton compact g={g} e={pick('spread', 'home')} line={pick('spread', 'home') ? fmtLine(pick('spread', 'home')!.line!) : ''} source={source} /></div></Td>
                        <Td><div className="grid min-w-[190px] grid-cols-2 gap-1.5"><PriceButton compact g={g} e={pick('total', 'over')} line={`O ${pick('total', 'over')?.line ?? ''}`} source={source} /><PriceButton compact g={g} e={pick('total', 'under')} line={`U ${pick('total', 'under')?.line ?? ''}`} source={source} /></div></Td>
                        <Td><div className={clsx('grid gap-1.5', cfg.threeWay ? 'min-w-[270px] grid-cols-3' : 'min-w-[190px] grid-cols-2')}><PriceButton compact g={g} e={pick('ml', 'away')} line="Away" source={source} />{cfg.threeWay && <PriceButton compact g={g} e={pick('ml', 'draw')} line="Draw" source={source} />}<PriceButton compact g={g} e={pick('ml', 'home')} line="Home" source={source} /></div></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Win probability" subtitle="Model vs no-vig market vs blended">
            <div className="space-y-3">
              {mlRows.map((r, i) => {
                const side = cfg.threeWay ? (['home', 'draw', 'away'] as const)[i] : (['home', 'away'] as const)[i];
                const bl = blendFor(side);
                return (
                  <div key={r.k}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="truncate font-medium">{r.k}</span><span className="num text-fg">{pct(bl ?? r.model)}</span></div>
                    {[{ l: 'Model', v: r.model, c: '#34d399' }, { l: 'Market', v: r.mkt ?? NaN, c: '#7c8a9c' }].map((x) => (
                      <div key={x.l} className="mt-1 flex items-center gap-2">
                        <span className="w-12 text-[10.5px] text-muted">{x.l}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(x.v || 0) * 100}%`, background: x.c }} /></div>
                        <span className="num w-12 text-right text-[11px] text-fg-2">{pct(x.v)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Model factors" subtitle={`How the projected ${cfg.scoreModel === 'margin' ? 'margin' : 'goal edge'} is built`}>
            <div className="space-y-1.5 text-[12.5px]">
              <Row k={`${g.home} net rating`} v={snum(hr?.net ?? 0, 2)} />
              <Row k={`minus ${g.away} net rating`} v={snum(-(ar?.net ?? 0), 2)} />
              {pred.adjustments.map((a) => <Row key={a.label} k={a.label} v={snum(a.value, 2)} />)}
              <div className="my-2 border-t border-line" />
              <Row k={<b>Projected margin</b>} v={<b>{snum(dist.muHome - dist.muAway, 2)}</b>} />
              <Row k="Rating uncertainty (±1σ)" v={`±${num(Math.sqrt(pred.marginVar), 2)}`} />
              <Row k="Reg. tie probability" v={pct(dist.pRegTie)} />
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-1.5"><SlidersHorizontal size={13} /> Adjust</span>} subtitle="Injuries, weather, lineup news. Moves the model instantly." right={(adj.home || adj.away || adj.total) ? <Button size="sm" variant="ghost" onClick={() => setAdj(g.id, null)}>Reset</Button> : null}>
            <div className="space-y-4">
              {[{ k: 'home' as const, l: `${g.home.split(' ').pop()} ${unit}` }, { k: 'away' as const, l: `${g.away.split(' ').pop()} ${unit}` }, { k: 'total' as const, l: `Pace / total ${unit}` }].map((x) => {
                const r = cfg.scoreModel === 'margin' ? 7 : 1;
                return <Slider key={x.k} label={x.l} min={-r} max={r} step={cfg.scoreModel === 'margin' ? 0.5 : 0.05} value={adj[x.k]} format={(v) => snum(v, cfg.scoreModel === 'margin' ? 1 : 2)} onChange={(v) => setAdj(g.id, { ...adj, [x.k]: v })} />;
              })}
            </div>
          </Card>

          <Card title="Best plays" subtitle="Best available price per selection">
            <div className="space-y-1.5">
              {ranked.slice(0, 6).map((e) => (
                <div key={`${e.market}${e.side}`} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-medium">{selectionLabel(g, e.market, e.side, e.line)}</div>
                    <div className="text-[10.5px] text-muted">{e.book} · fair {pct(e.blend.win / Math.max(1e-9, 1 - e.blend.push))}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num text-[13px] font-semibold">{odds(e.decimal)}</span>
                    <EvBadge ev={e.ev} />
                    <button onClick={() => add(g, e, source)} className="rounded-md p-1 text-muted hover:bg-panel-3 hover:text-pos" aria-label="Add to slip"><Plus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {dist.scoreGrid && (
            <Card title="Most likely scores" subtitle={cfg.threeWay ? 'Full time' : 'End of regulation'}>
              <div className="grid grid-cols-4 gap-1.5">
                {topScores(dist.scoreGrid).map((s) => (
                  <div key={`${s.h}-${s.a}`} className="rounded-lg bg-panel-2 px-2 py-1.5 text-center ring-1 ring-line">
                    <div className="num text-[13px] font-semibold">{s.a}–{s.h}</div>
                    <div className="num text-[10.5px] text-muted">{pct(s.p)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function topScores(grid: number[][]) {
  const all: { h: number; a: number; p: number }[] = [];
  grid.forEach((row, h) => row.forEach((p, a) => all.push({ h, a, p })));
  return all.sort((x, y) => y.p - x.p).slice(0, 8);
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="truncate text-fg-2">{k}</span><span className="num shrink-0">{v}</span></div>;
}

const teamColor = (s: SportKey, n: string) => teamInfo(s, n).color;

function TeamSide({ sport, name, rec, label, right, netFmt }: { sport: SportKey; name: string; rec?: TeamRating; label: string; right?: boolean; netFmt: number }) {
  return (
    <div className={clsx('flex min-w-0 flex-1 items-center gap-3', right && 'flex-row-reverse text-right')}>
      <TeamChip sport={sport} name={name} size="lg" />
      <div className="min-w-0">
        <div className="text-[10.5px] uppercase tracking-wider text-muted">{label}</div>
        <div className="truncate text-lg font-semibold tracking-tight">{name}</div>
        {rec && <div className="num text-xs text-muted">{rec.w}-{rec.l}{rec.t ? `-${rec.t}` : ''} · net {snum(rec.net, netFmt)}</div>}
      </div>
    </div>
  );
}
