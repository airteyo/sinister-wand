import clsx from 'clsx';
import { Activity, ChevronRight, Radio, RefreshCw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEng } from '../components/EngineContext';
import { PriceButton } from '../components/Price';
import { Badge, Button, Card, Empty, PageHeader, ProbBar, Segmented, TeamChip, teamInfo } from '../components/ui';
import type { Evaluation } from '../lib/analysis';
import { disagreement } from '../lib/backtest';
import { pct, snum } from '../lib/format';
import { fairSpread, fairTotal } from '../lib/model/pricing';
import { fmtLine } from '../lib/odds';
import { SPORTS } from '../lib/sports';
import { useStore } from '../lib/store';
import type { Game } from '../lib/types';

export function GameRow({ g, dim }: { g: Game; dim?: boolean }) {
  const eng = useEng();
  const go = useStore((s) => s.go);
  const cfg = SPORTS[g.sport];
  const best = eng.best.get(g.id) ?? [];
  const dist = eng.dists.get(g.id);
  const pick = (m: Evaluation['market'], s: Evaluation['side']) => best.find((e) => e.market === m && e.side === s);
  const sharp = g.books.find((b) => b.book === 'Sharp')?.current;
  const hr = eng.model.teams.get(g.home), ar = eng.model.teams.get(g.away);
  const mlH = pick('ml', 'home'), mlA = pick('ml', 'away'), mlD = pick('ml', 'draw');
  const maxDis = useStore((s) => s.bt.maxDisagreement);
  const top = best.filter((e) => disagreement(e) <= maxDis).reduce<Evaluation | null>((a, e) => (!a || e.ev > a.ev ? e : a), null);
  const time = g.commence ? new Date(g.commence).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null;
  const source = g.live ? 'live' : 'demo';
  const rec = (t?: { w: number; l: number; t: number }) => (t ? `${t.w}-${t.l}${t.t ? `-${t.t}` : ''}` : '');

  return (
    <div
      onClick={() => go('game', g.id)}
      className={clsx('group cursor-pointer rounded-2xl border border-line bg-panel/80 p-3.5 transition-colors hover:border-line-2 hover:bg-panel sm:p-4', dim && 'opacity-80')}
    >
      <div className="grid gap-3.5 xl:grid-cols-[minmax(240px,1.25fr)_minmax(150px,0.7fr)_1fr_1fr_1fr] xl:items-center">
        {/* matchup */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[11px] text-muted">
            {time ?? new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            {top && top.ev >= 0.03 && <Badge tone="pos"><Sparkles size={10} /> {pct(top.ev)} edge</Badge>}
            {(g.homeRest === 0 || g.awayRest === 0) && cfg.b2bPenalty > 0 && <Badge tone="warn">B2B</Badge>}
          </div>
          {[{ name: g.away, r: ar, p: dist ? (cfg.threeWay ? dist.pAway : dist.pAway) : NaN }, { name: g.home, r: hr, p: dist?.pHome ?? NaN }].map((t, i) => (
            <div key={t.name} className="flex items-center gap-2.5 py-0.5">
              <TeamChip sport={g.sport} name={t.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{t.name}{i === 1 && <span className="ml-1.5 text-[10px] text-faint">HOME</span>}</div>
                <div className="num text-[10.5px] text-muted">{rec(t.r)}{t.r && eng.hasModel ? ` · ${snum(t.r.net, cfg.scoreModel === 'margin' ? 1 : 2)}` : ''}</div>
              </div>
              {g.result ? (
                <div className="num text-lg font-semibold">{i === 0 ? g.result.away : g.result.home}</div>
              ) : (
                <div className="num text-[12px] text-fg-2">{pct(t.p, 0)}</div>
              )}
            </div>
          ))}
        </div>
        {/* model */}
        <div className="rounded-xl bg-panel-2/70 px-3 py-2.5 ring-1 ring-line">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted"><span>Model fair</span><span>Mkt</span></div>
          {dist && (
            <div className="num mt-1.5 space-y-1 text-[12px]">
              <div className="flex justify-between"><span>{fmtLine(Math.round(fairSpread(dist) * 10) / 10)}</span><span className="text-muted">{sharp && isFinite(sharp.spread) ? fmtLine(sharp.spread) : '—'}</span></div>
              <div className="flex justify-between"><span>o{fairTotal(dist).toFixed(1)}</span><span className="text-muted">{sharp && isFinite(sharp.total) ? sharp.total : '—'}</span></div>
            </div>
          )}
          {dist && <div className="mt-2"><ProbBar a={dist.pAway} b={dist.pHome} c={cfg.threeWay ? dist.pDraw : undefined} colors={['#60a5fa', '#34d399', '#4f5b6b']} /></div>}
        </div>
        {/* markets */}
        {[
          { title: cfg.spreadName, a: pick('spread', 'away'), b: pick('spread', 'home'), la: (e?: Evaluation) => (e?.line != null ? fmtLine(e.line) : ''), lb: (e?: Evaluation) => (e?.line != null ? fmtLine(e.line) : '') },
          { title: 'Total', a: pick('total', 'over'), b: pick('total', 'under'), la: (e?: Evaluation) => (e ? `O ${e.line}` : ''), lb: (e?: Evaluation) => (e ? `U ${e.line}` : '') },
          { title: cfg.threeWay ? '1 × 2' : 'Moneyline', a: mlA, b: mlH, la: () => teamInfo(g.sport, g.away).abbr, lb: () => teamInfo(g.sport, g.home).abbr, c: mlD },
        ].map((m) => (
          <div key={m.title}>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted xl:hidden">{m.title}</div>
            <div className={clsx('grid gap-1.5', 'c' in m && m.c ? 'grid-cols-3 xl:grid-cols-1' : 'grid-cols-2 xl:grid-cols-1')}>
              <PriceButton g={g} e={m.a} line={m.la(m.a)} source={source} compact />
              {'c' in m && m.c && <PriceButton g={g} e={m.c} line="Draw" source={source} compact />}
              <PriceButton g={g} e={m.b} line={m.lb(m.b)} source={source} compact />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 hidden justify-end text-[11px] text-faint group-hover:text-muted xl:flex">Deep dive <ChevronRight size={13} /></div>
    </div>
  );
}

export default function Board() {
  const eng = useEng();
  const cfg = SPORTS[eng.sport];
  const minEdge = useStore((s) => s.minEdge);
  const maxDis = useStore((s) => s.bt.maxDisagreement);
  const [filter, setFilter] = useState<'all' | 'edges'>('all');
  const [sort, setSort] = useState<'time' | 'edge'>('time');

  const topEv = (g: Game) => Math.max(-1, ...(eng.best.get(g.id) ?? []).filter((e) => disagreement(e) <= maxDis).map((e) => e.ev));
  const rows = useMemo(() => {
    let r = eng.slate.filter((g) => !g.result);
    if (filter === 'edges') r = r.filter((g) => topEv(g) >= minEdge);
    if (sort === 'edge') r = [...r].sort((a, b) => topEv(b) - topEv(a));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng, filter, sort, minEdge, maxDis]);
  const edges = eng.slate.reduce((a, g) => a + (eng.best.get(g.id) ?? []).filter((e) => e.ev >= minEdge && disagreement(e) <= maxDis).length, 0);

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2">Odds board {eng.mode === 'live' && <Badge tone="pos"><Radio size={11} /> Live</Badge>}</span>}
        subtitle={`${cfg.league} · ${eng.todayLabel} · ${eng.slate.length} games · ${edges} qualifying price${edges === 1 ? '' : 's'} (≥ ${pct(minEdge, 1)} edge, ≤ ${pct(maxDis, 0)} model/market gap). Amber = big disagreement, usually missing news.`}
        right={
          <>
            <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All games' }, { value: 'edges', label: '+EV only' }]} />
            <Segmented value={sort} onChange={setSort} options={[{ value: 'time', label: 'Time' }, { value: 'edge', label: 'Best edge' }]} />
            {eng.mode === 'live' && <Button size="sm" onClick={eng.live.refresh} disabled={eng.live.loading}><RefreshCw size={13} className={eng.live.loading ? 'animate-spin' : ''} /> Refresh</Button>}
          </>
        }
      />
      {eng.mode === 'live' && !eng.hasModel && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3 text-xs text-fg-2">
          <b className="text-warn">Market-only mode.</b> No results imported for {cfg.name}, so edges come purely from line shopping against the de-vigged consensus/Pinnacle line. Import historical results in Settings to switch on the rating model.
        </div>
      )}
      {eng.live.error && eng.mode === 'live' && <div className="mb-4 rounded-xl border border-neg/30 bg-neg/10 px-4 py-3 text-xs text-neg">{eng.live.error}</div>}
      <div className="space-y-2.5">
        {rows.length > 0 && (
          <div className="hidden grid-cols-[minmax(240px,1.25fr)_minmax(150px,0.7fr)_1fr_1fr_1fr] gap-3.5 px-4 text-[10px] font-medium uppercase tracking-wider text-muted xl:grid">
            <span>Matchup · win prob</span><span>Model vs market</span><span>{cfg.spreadName}</span><span>Total</span><span>{cfg.threeWay ? '1 × 2' : 'Moneyline'}</span>
          </div>
        )}
        {rows.map((g) => <GameRow key={g.id} g={g} />)}
        {!rows.length && (
          <Card><Empty icon={<Activity size={28} />} title={eng.live.loading ? 'Loading odds…' : filter === 'edges' ? 'No prices clear your edge threshold' : 'No games on this slate'}>
            {filter === 'edges' ? 'That is normal — most of the board is efficiently priced. Lower the threshold in Settings or check another day.' : eng.mode === 'demo' ? 'Sim forward to the next game-day.' : 'The Odds API returned no upcoming events for this league.'}
          </Empty></Card>
        )}
      </div>
      {eng.upcoming.length > 0 && filter === 'all' && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-fg-2">Next up · openers posted</h2>
          <div className="space-y-2.5">{eng.upcoming.slice(0, 16).map((g) => <GameRow key={g.id} g={g} dim />)}</div>
        </div>
      )}
    </div>
  );
}
