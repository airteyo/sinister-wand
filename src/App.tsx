import clsx from 'clsx';
import { Calculator, FastForward, FlaskConical, LayoutDashboard, Radio, Receipt, RotateCcw, Settings, Table2, Ticket, Trophy } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { BetSlip, useBankroll } from './components/BetSlip';
import { EngineCtx } from './components/EngineContext';
import { Badge, Button } from './components/ui';
import { money } from './lib/format';
import { SPORTS, SPORT_KEYS } from './lib/sports';
import { useStore, type Page } from './lib/store';
import { useEngine } from './lib/useEngine';
import Bets from './pages/Bets';
import Board from './pages/Board';
import GameView from './pages/GameView';
import Lab from './pages/Lab';
import Overview from './pages/Overview';
import Ratings from './pages/Ratings';
import SettingsPage from './pages/Settings';
import Tools from './pages/Tools';

const NAV: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { page: 'board', label: 'Odds board', icon: <Table2 size={16} /> },
  { page: 'ratings', label: 'Power ratings', icon: <Trophy size={16} /> },
  { page: 'lab', label: 'Model lab', icon: <FlaskConical size={16} /> },
  { page: 'bets', label: 'Bet tracker', icon: <Receipt size={16} /> },
  { page: 'tools', label: 'Calculators', icon: <Calculator size={16} /> },
  { page: 'settings', label: 'Settings', icon: <Settings size={16} /> },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#0f2a20] to-[#0a1219] ring-1 ring-pos/30">
        <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M5 23 L12 15 L18 19 L27 8" stroke="#34d399" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="hidden leading-tight sm:block">
        <div className="text-[15px] font-semibold tracking-tight">EdgeLab</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Quant betting</div>
      </div>
    </div>
  );
}

export default function App() {
  const engine = useEngine();
  const { page, go, sport, set, advance, resetDay, slip } = useStore();
  const bank = useBankroll();
  const openBets = useStore((s) => s.bets.filter((b) => b.status === 'open').length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'n' && engine.canAdvance) advance(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine.canAdvance, advance]);

  let content: ReactNode;
  switch (page) {
    case 'board': content = <Board />; break;
    case 'game': content = <GameView />; break;
    case 'ratings': content = <Ratings />; break;
    case 'lab': content = <Lab />; break;
    case 'bets': content = <Bets />; break;
    case 'tools': content = <Tools />; break;
    case 'settings': content = <SettingsPage />; break;
    default: content = <Overview />;
  }

  return (
    <EngineCtx.Provider value={engine}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-5 backdrop-blur lg:flex">
          <div className="px-2"><Logo /></div>
          <nav className="mt-8 space-y-0.5">
            {NAV.map((n) => (
              <button
                key={n.page}
                onClick={() => go(n.page)}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                  page === n.page || (page === 'game' && n.page === 'board') ? 'bg-panel-3 text-fg ring-1 ring-line-2' : 'text-muted hover:bg-panel-2 hover:text-fg',
                )}
              >
                <span className={clsx(page === n.page || (page === 'game' && n.page === 'board') ? 'text-pos' : '')}>{n.icon}</span>
                {n.label}
                {n.page === 'bets' && openBets > 0 && <span className="num ml-auto rounded bg-panel-3 px-1.5 text-[10px] text-fg-2">{openBets}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-3 px-1">
            <div className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">Bankroll</div>
              <div className="num mt-1 text-lg font-semibold">{money(bank.current)}</div>
              <div className={clsx('num text-[11px]', bank.pnl >= 0 ? 'text-pos' : 'text-neg')}>{bank.pnl >= 0 ? '+' : ''}{money(bank.pnl)} all-time</div>
              {bank.exposure > 0 && <div className="num mt-0.5 text-[11px] text-muted">{money(bank.exposure)} at risk</div>}
            </div>
            <p className="px-1 text-[10px] leading-relaxed text-faint">For research & entertainment. Bet responsibly — 1-800-GAMBLER.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
              <div className="lg:hidden"><Logo /></div>
              <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
                {SPORT_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => set({ sport: k, page: page === 'game' ? 'board' : page })}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
                      sport === k ? 'bg-panel-3 text-fg ring-1 ring-line-2' : 'text-muted hover:text-fg',
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SPORTS[k].accent, opacity: sport === k ? 1 : 0.4 }} />
                    {SPORTS[k].name}
                  </button>
                ))}
              </div>
              <div className="hidden items-center gap-2 md:flex">
                {engine.mode === 'live' ? (
                  <Badge tone="pos"><Radio size={11} /> Live odds</Badge>
                ) : (
                  <Badge tone="violet" className="hidden xl:inline-flex">Simulated league</Badge>
                )}
                <div className="text-right leading-tight">
                  <div className="text-xs font-semibold">{engine.todayLabel}</div>
                  <div className="text-[10.5px] text-muted">{SPORTS[sport].name} {engine.seasonLabel}</div>
                </div>
              </div>
              {engine.mode === 'demo' && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={resetDay} title="Rewind to the start of the demo (clears simulated bets for this sport)"><RotateCcw size={13} /></Button>
                  <Button size="sm" onClick={() => advance(1)} disabled={!engine.canAdvance} title="Play today's games and move to the next slate (shortcut: N)">
                    <FastForward size={13} /> <span className="hidden sm:inline">Sim day</span>
                  </Button>
                </div>
              )}
              <Button size="sm" variant={slip.length ? 'primary' : 'secondary'} onClick={() => set({ slipOpen: true })}>
                <Ticket size={13} /> <span className="num">{slip.length}</span>
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-10">
            <div key={`${page}-${sport}`} className="fade-in">{content}</div>
          </main>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-panel/95 px-1 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        {NAV.filter((n) => n.page !== 'settings' && n.page !== 'tools').concat(NAV.filter((n) => n.page === 'settings')).map((n) => (
          <button key={n.page} onClick={() => go(n.page)} className={clsx('flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium', page === n.page ? 'text-pos' : 'text-muted')}>
            {n.icon}
            {n.label.split(' ')[0]}
          </button>
        ))}
      </nav>
      <BetSlip />
    </EngineCtx.Provider>
  );
}
