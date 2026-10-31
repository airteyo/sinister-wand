import { Database, ExternalLink, KeyRound, Radio, Shuffle, Upload, Wallet } from 'lucide-react';
import { useRef, useState } from 'react';
import { useEng } from '../components/EngineContext';
import { Badge, Button, Card, Field, inputCls, PageHeader, Segmented, Slider } from '../components/ui';
import { pct } from '../lib/format';
import { parseResultsCsv } from '../lib/live';
import { SPORTS } from '../lib/sports';
import { useStore } from '../lib/store';

export default function SettingsPage() {
  const s = useStore();
  const eng = useEng();
  const cfg = SPORTS[s.sport];
  const [key, setKey] = useState(s.oddsApiKey);
  const [seed, setSeed] = useState(String(s.seed));
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const imported = s.imported[s.sport];

  const ingest = (text: string) => {
    const { games, errors } = parseResultsCsv(s.sport, text);
    if (!games.length) { setCsvMsg(errors.join(' ') || 'No games found.'); return; }
    s.set({ imported: { ...s.imported, [s.sport]: { games, importedAt: new Date().toISOString() } } });
    setCsvMsg(`Imported ${games.length.toLocaleString()} ${cfg.name} games (${games[0].date} → ${games[games.length - 1].date}).${errors.length ? ` Skipped some rows: ${errors.join('; ')}` : ''}`);
    setPaste('');
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Everything is stored locally in your browser" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-1.5"><Wallet size={14} /> Bankroll & staking</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starting bankroll ($)"><input className={inputCls} type="number" value={s.bankroll} onChange={(e) => s.set({ bankroll: Math.max(0, Number(e.target.value)) })} /></Field>
            <Field label="Odds format"><Segmented value={s.oddsFormat} onChange={(v) => s.set({ oddsFormat: v })} options={[{ value: 'american', label: 'American' }, { value: 'decimal', label: 'Decimal' }]} /></Field>
            <Slider label="Kelly fraction" min={0.05} max={1} step={0.05} value={s.kellyFraction} onChange={(v) => s.set({ kellyFraction: v })} format={(v) => `${Math.round(v * 100)}%`} hint="Quarter Kelly is a common professional default: ~94% less variance for ~44% less growth." />
            <Slider label="Max stake per bet" min={0.005} max={0.1} step={0.005} value={s.maxStakePct} onChange={(v) => s.set({ maxStakePct: v })} format={(v) => pct(v)} />
            <Slider label="Edge threshold (highlight / filter)" min={0} max={0.1} step={0.0025} value={s.minEdge} onChange={(v) => s.set({ minEdge: v })} format={(v) => pct(v)} />
            <Field label="De-vig method" hint="Shin accounts for favourite–longshot bias; power is a close second.">
              <Segmented value={s.devig} onChange={(v) => s.set({ devig: v })} options={[{ value: 'shin', label: 'Shin' }, { value: 'power', label: 'Power' }, { value: 'additive', label: 'Add' }, { value: 'multiplicative', label: 'Mult' }]} />
            </Field>
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><Radio size={14} /> Data source</span>} right={eng.mode === 'live' ? <Badge tone="pos">Live</Badge> : <Badge tone="violet">Simulator</Badge>}>
          <div className="space-y-4">
            <Segmented value={s.dataMode} onChange={(v) => s.set({ dataMode: v })} options={[{ value: 'demo', label: 'Simulated league' }, { value: 'live', label: 'Live odds' }]} />
            {s.dataMode === 'demo' ? (
              <p className="text-xs leading-relaxed text-muted">
                A full synthetic universe for every league: three seasons of latent team strength that drifts over time, games played out from it, and five books pricing each game from a noisy view of the truth. The model only ever sees scores and prices — so backtests, CLV and calibration behave like the real thing. Use <b className="text-fg-2">Sim day</b> to play the slate.
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Pulls real moneyline, spread and total prices from every book via <a className="text-info hover:underline" href="https://the-odds-api.com" target="_blank" rel="noreferrer">The Odds API <ExternalLink size={10} className="inline" /></a> (free tier: 500 requests/month). The no-vig reference is Pinnacle when available, otherwise the de-vigged consensus. Import results below to switch the rating model on.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1"><KeyRound size={13} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" /><input className={`${inputCls} pl-8`} type="password" placeholder="Odds API key" value={key} onChange={(e) => setKey(e.target.value)} /></div>
                  <Button variant="primary" onClick={() => s.set({ oddsApiKey: key.trim() })}>Save</Button>
                </div>
                <Field label="Regions"><input className={inputCls} value={s.oddsRegions} onChange={(e) => s.set({ oddsRegions: e.target.value })} /></Field>
                {eng.live.data && <div className="text-[11px] text-muted">Last fetch {new Date(eng.live.data.fetchedAt).toLocaleTimeString()} · {eng.live.data.games.length} events · {eng.live.data.remaining ?? '?'} requests left</div>}
                {eng.live.error && <div className="text-[11px] text-neg">{eng.live.error}</div>}
                {!s.oddsApiKey && <div className="text-[11px] text-warn">Add a key to activate live mode — until then the simulator stays on.</div>}
              </>
            )}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><Database size={14} /> Historical results · {cfg.name}</span>} subtitle="Feeds the rating model in live mode" right={imported && <Badge tone="pos">{imported.games.length.toLocaleString()} games</Badge>}>
          <div className="space-y-3">
            <p className="text-xs text-muted">CSV with a header row: <code className="num rounded bg-panel-3 px-1 text-fg-2">date,home,away,home_score,away_score</code>. Team names must match the odds feed (e.g. “Kansas City Chiefs”). football-data.co.uk files (HomeTeam, AwayTeam, FTHG, FTAG) work as-is.</p>
            <textarea className={`${inputCls} h-24 py-2 font-mono text-[11px]`} placeholder={'date,home,away,home_score,away_score\n2025-09-07,Buffalo Bills,Baltimore Ravens,41,40'} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => ingest(paste)} disabled={!paste.trim()}>Import pasted</Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload CSV</Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) ingest(await f.text()); e.target.value = ''; }} />
              {imported && <Button size="sm" variant="danger" onClick={() => { const next = { ...s.imported }; delete next[s.sport]; s.set({ imported: next }); setCsvMsg('Cleared.'); }}>Clear</Button>}
            </div>
            {csvMsg && <div className="text-[11px] text-fg-2">{csvMsg}</div>}
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><Shuffle size={14} /> Simulated universe</span>}>
          <div className="space-y-3">
            <p className="text-xs text-muted">Each seed is a different multi-season history for every league. Changing it re-rolls teams’ talent, schedules, results and prices.</p>
            <div className="flex gap-2">
              <input className={inputCls} value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} />
              <Button onClick={() => s.set({ seed: Number(seed) || 1, dayOffset: {}, bets: s.bets.filter((b) => b.source !== 'demo'), adjustments: {} })}>Apply</Button>
              <Button variant="ghost" onClick={() => { const n = Math.floor(Math.random() * 1e6); setSeed(String(n)); s.set({ seed: n, dayOffset: {}, bets: s.bets.filter((b) => b.source !== 'demo'), adjustments: {} }); }}>Random</Button>
            </div>
            <div className="border-t border-line pt-3">
              <Button variant="danger" size="sm" onClick={() => { if (confirm('Erase all bets, settings and imported data?')) { localStorage.removeItem('edgelab-v1'); location.reload(); } }}>Reset everything</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
