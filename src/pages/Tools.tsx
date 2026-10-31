import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, Field, inputCls, PageHeader, Slider } from '../components/ui';
import { money, pct, spct } from '../lib/format';
import { americanToDecimal, arbitrage, decimalToAmerican, devig, expectedValue, fmtAmerican, hedge, kelly, overround, parlay, type DevigMethod } from '../lib/odds';

const parseOdds = (s: string): number => {
  const t = s.trim();
  if (!t) return NaN;
  if (/^[+-]\d+$/.test(t) && Math.abs(Number(t)) >= 100) return americanToDecimal(Number(t));
  if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/').map(Number); return 1 + a / b; }
  const n = Number(t);
  if (isFinite(n) && Math.abs(n) >= 100) return americanToDecimal(n);
  return n > 1 ? n : NaN;
};

function Converter() {
  const [d, setD] = useState(1.9091);
  const frac = (() => { const x = d - 1; for (let den = 1; den <= 100; den++) { const num = Math.round(x * den); if (Math.abs(num / den - x) < 0.005) return `${num}/${den}`; } return x.toFixed(2); })();
  return (
    <Card title="Odds converter" subtitle="Type into any field">
      <div className="grid grid-cols-2 gap-3">
        <Field label="American"><input className={inputCls} key={`a${d}`} defaultValue={fmtAmerican(decimalToAmerican(d))} onBlur={(e) => { const v = parseOdds(e.target.value); if (v) setD(v); }} /></Field>
        <Field label="Decimal"><input className={inputCls} key={`d${d}`} defaultValue={d.toFixed(3)} onBlur={(e) => { const v = Number(e.target.value); if (v > 1) setD(v); }} /></Field>
        <Field label="Fractional"><input className={inputCls} key={`f${d}`} defaultValue={frac} onBlur={(e) => { const v = parseOdds(e.target.value); if (v) setD(v); }} /></Field>
        <Field label="Implied probability"><input className={inputCls} key={`p${d}`} defaultValue={(100 / d).toFixed(2) + '%'} onBlur={(e) => { const v = parseFloat(e.target.value) / 100; if (v > 0 && v < 1) setD(1 / v); }} /></Field>
      </div>
    </Card>
  );
}

function NoVig() {
  const [prices, setPrices] = useState(['-150', '+130']);
  const decs = prices.map(parseOdds);
  const ok = decs.every((x) => x > 1);
  const methods: DevigMethod[] = ['multiplicative', 'additive', 'power', 'shin'];
  return (
    <Card title="No-vig fair odds" subtitle="Strip the bookmaker margin four ways" right={prices.length < 3 ? <button className="text-xs text-muted hover:text-fg" onClick={() => setPrices([...prices, '+250'])}>+ 3-way</button> : <button className="text-xs text-muted hover:text-fg" onClick={() => setPrices(prices.slice(0, 2))}>2-way</button>}>
      <div className={`grid gap-3 ${prices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {prices.map((p, i) => <Field key={i} label={['Side A', 'Side B', 'Draw'][i]}><input className={inputCls} value={p} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? e.target.value : x)))} /></Field>)}
      </div>
      {ok && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-muted">Hold <span className="num text-fg">{pct(overround(decs) / (1 + overround(decs)), 2)}</span></div>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-muted"><th className="pb-1.5 font-medium">Method</th>{prices.map((_, i) => <th key={i} className="pb-1.5 text-right font-medium">{['A', 'B', 'Draw'][i]}</th>)}</tr></thead>
            <tbody>
              {methods.map((m) => {
                const f = devig(decs, m);
                return (
                  <tr key={m} className="border-t border-line/60">
                    <td className="py-1.5 capitalize text-fg-2">{m}</td>
                    {f.map((p, i) => <td key={i} className="num py-1.5 text-right">{pct(p)} <span className="text-faint">{fmtAmerican(decimalToAmerican(1 / p))}</span></td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function KellyCalc() {
  const [odds, setOdds] = useState('+110');
  const [prob, setProb] = useState(52);
  const [push, setPush] = useState(0);
  const [bank, setBank] = useState(10000);
  const [frac, setFrac] = useState(0.25);
  const d = parseOdds(odds);
  const p = prob / 100, q = push / 100;
  const ev = d > 1 ? expectedValue(p, d, q) : NaN;
  const k = d > 1 ? kelly(p, d, q) : 0;
  return (
    <Card title="EV & Kelly stake" subtitle="Push-aware Kelly criterion">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Odds"><input className={inputCls} value={odds} onChange={(e) => setOdds(e.target.value)} /></Field>
        <Field label="Bankroll"><input className={inputCls} type="number" value={bank} onChange={(e) => setBank(Number(e.target.value))} /></Field>
      </div>
      <div className="mt-4 space-y-4">
        <Slider label="Your win probability" min={1} max={99} step={0.5} value={prob} onChange={setProb} format={(v) => `${v}%`} />
        <Slider label="Push probability" min={0} max={20} step={0.5} value={push} onChange={setPush} format={(v) => `${v}%`} />
        <Slider label="Kelly fraction" min={0.05} max={1} step={0.05} value={frac} onChange={setFrac} format={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-panel-2 p-2.5 ring-1 ring-line"><div className="text-[10px] uppercase text-muted">EV</div><div className={`num text-sm font-semibold ${ev >= 0 ? 'text-pos' : 'text-neg'}`}>{spct(ev)}</div></div>
        <div className="rounded-xl bg-panel-2 p-2.5 ring-1 ring-line"><div className="text-[10px] uppercase text-muted">Full Kelly</div><div className="num text-sm font-semibold">{pct(k, 2)}</div></div>
        <div className="rounded-xl bg-panel-2 p-2.5 ring-1 ring-line"><div className="text-[10px] uppercase text-muted">Stake</div><div className="num text-sm font-semibold">{money(bank * k * frac)}</div></div>
      </div>
      <div className="mt-2 text-[11px] text-muted">Break-even at this price: <span className="num text-fg-2">{d > 1 ? pct(1 / d) : '—'}</span></div>
    </Card>
  );
}

function ParlayCalc() {
  const [legs, setLegs] = useState([{ odds: '-110', prob: 52.4 }, { odds: '-110', prob: 52.4 }]);
  const [corr, setCorr] = useState(0);
  const parsed = legs.map((l) => ({ decimal: parseOdds(l.odds), prob: l.prob / 100 }));
  const ok = parsed.every((l) => l.decimal > 1);
  const r = ok ? parlay(parsed, corr) : null;
  return (
    <Card title="Parlay pricer" subtitle="True odds vs payout, with optional correlation" right={legs.length < 8 && <button className="flex items-center gap-1 text-xs text-muted hover:text-fg" onClick={() => setLegs([...legs, { odds: '-110', prob: 52.4 }])}><Plus size={12} /> Leg</button>}>
      <div className="space-y-2">
        {legs.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="num w-5 text-[11px] text-faint">{i + 1}</span>
            <input className={inputCls} value={l.odds} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, odds: e.target.value } : x)))} />
            <div className="relative w-28 shrink-0"><input className={`${inputCls} pr-6`} type="number" value={l.prob} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? { ...x, prob: Number(e.target.value) } : x)))} /><span className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted">%</span></div>
            {legs.length > 2 && <button onClick={() => setLegs(legs.filter((_, j) => j !== i))} className="text-faint hover:text-neg" aria-label="Remove leg"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      <div className="mt-4"><Slider label="Leg correlation (ρ)" min={-0.3} max={0.6} step={0.05} value={corr} onChange={setCorr} format={(v) => v.toFixed(2)} hint="Same-game parlays are positively correlated (e.g. favourite + over)." /></div>
      {r && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-panel-2 p-2.5 ring-1 ring-line"><div className="text-[10px] uppercase text-muted">Payout</div><div className="num text-sm font-semibold">{fmtAmerican(r.american)}</div></div>
          <div className="rounded-xl bg-panel-2 p-2.5 ring-1 ring-line"><div className="text-[10px] uppercase text-muted">True prob</div><div className="num text-sm font-semibold">{pct(r.prob, 2)}</div><div className="num text-[10px] text-faint">{fmtAmerican(decimalToAmerican(1 / r.prob))}</div></div>
          <div className="rounded-xl bg-panel-2 p-2.5 ring-1 ring-line"><div className="text-[10px] uppercase text-muted">EV</div><div className={`num text-sm font-semibold ${r.ev >= 0 ? 'text-pos' : 'text-neg'}`}>{spct(r.ev)}</div></div>
        </div>
      )}
    </Card>
  );
}

function HedgeCalc() {
  const [stake, setStake] = useState(100);
  const [orig, setOrig] = useState('+400');
  const [now, setNow] = useState('-150');
  const a = parseOdds(orig), b = parseOdds(now);
  const h = a > 1 && b > 1 ? hedge(stake, a, b) : null;
  const arb = a > 1 && b > 1 ? arbitrage(a, b) : null;
  return (
    <Card title="Hedge & arbitrage" subtitle="Lock in profit or find a risk-free pair">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Original stake"><input className={inputCls} type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} /></Field>
        <Field label="Original odds"><input className={inputCls} value={orig} onChange={(e) => setOrig(e.target.value)} /></Field>
        <Field label="Other side now"><input className={inputCls} value={now} onChange={(e) => setNow(e.target.value)} /></Field>
      </div>
      {h && arb && (
        <div className="mt-4 space-y-1.5 text-[12.5px]">
          <div className="flex justify-between"><span className="text-fg-2">Hedge stake for equal outcome</span><span className="num">{money(h.hedgeStake, 2)}</span></div>
          <div className="flex justify-between"><span className="text-fg-2">Guaranteed profit</span><span className={`num ${h.lockedProfit >= 0 ? 'text-pos' : 'text-neg'}`}>{money(h.lockedProfit, 2)}</span></div>
          <div className="flex items-center justify-between pt-2"><span className="text-fg-2">Treated as a fresh pair</span>{arb.isArb ? <Badge tone="pos">Arb {pct(arb.margin, 2)}</Badge> : <Badge>No arb · hold {pct(-arb.margin, 2)}</Badge>}</div>
          {arb.isArb && <div className="text-[11px] text-muted">Split stakes {pct(arb.stake1, 1)} / {pct(arb.stake2, 1)}.</div>}
        </div>
      )}
    </Card>
  );
}

export default function Tools() {
  return (
    <div>
      <PageHeader title="Calculators" subtitle="Accepts American (+150 / -110), decimal (2.50) or fractional (3/2) odds" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <NoVig />
        <KellyCalc />
        <ParlayCalc />
        <Converter />
        <HedgeCalc />
      </div>
    </div>
  );
}
