import clsx from 'clsx';
import type { ReactNode } from 'react';
import { TEAMS } from '../lib/data/teams';
import type { SportKey } from '../lib/sports';

export function Card({ title, subtitle, right, children, className, pad = true }: { title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx('rounded-2xl border border-line bg-panel/80 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]', className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2 sm:px-5">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold tracking-tight text-fg">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={clsx(pad && 'px-4 pb-4 sm:px-5', !title && !right && pad && 'pt-4')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone, hint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' | 'warn' | 'info'; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/80 px-4 py-3.5" title={hint}>
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={clsx('num mt-1.5 text-[22px] font-semibold leading-none', tone === 'pos' && 'text-pos', tone === 'neg' && 'text-neg', tone === 'warn' && 'text-warn', tone === 'info' && 'text-info')}>{value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' | 'violet'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        tone === 'neutral' && 'bg-panel-3 text-fg-2 ring-line-2',
        tone === 'pos' && 'bg-pos/10 text-pos ring-pos/25',
        tone === 'neg' && 'bg-neg/10 text-neg ring-neg/25',
        tone === 'warn' && 'bg-warn/10 text-warn ring-warn/25',
        tone === 'info' && 'bg-info/10 text-info ring-info/25',
        tone === 'violet' && 'bg-violet/10 text-violet ring-violet/25',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({ children, onClick, variant = 'secondary', size = 'md', className, disabled, title, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; className?: string; disabled?: boolean; title?: string; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-[13px]',
        variant === 'primary' && 'bg-pos text-[#04110b] hover:bg-[#4ee0ab] shadow-[0_0_0_1px_rgba(52,211,153,0.4),0_8px_24px_-8px_rgba(52,211,153,0.5)]',
        variant === 'secondary' && 'border border-line-2 bg-panel-2 text-fg hover:border-[#33415a] hover:bg-panel-3',
        variant === 'ghost' && 'text-fg-2 hover:bg-panel-3 hover:text-fg',
        variant === 'danger' && 'border border-neg/30 bg-neg/10 text-neg hover:bg-neg/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
            value === o.value ? 'bg-panel-3 text-fg shadow-sm ring-1 ring-line-2' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format, hint }: { label: ReactNode; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block" title={hint}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-fg-2">{label}</span>
        <span className="num text-fg">{format ? format(value) : value}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} style={{ ['--fill' as string]: `${fill}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-fg-2 select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx('relative h-[18px] w-8 rounded-full transition-colors', checked ? 'bg-pos-2' : 'bg-line-2')}
      >
        <span className={clsx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', checked ? 'left-[16px]' : 'left-[2px]')} />
      </button>
      {label}
    </label>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs text-fg-2">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted">{hint}</div>}
    </label>
  );
}

export const inputCls =
  'num h-9 w-full rounded-lg border border-line-2 bg-panel-2 px-3 text-[13px] text-fg outline-none transition-colors placeholder:text-faint focus:border-pos/60 focus:ring-2 focus:ring-pos/15';

export function teamInfo(sport: SportKey, name: string) {
  return TEAMS[sport].find((t) => t.name === name) ?? { name, abbr: name.slice(0, 3).toUpperCase(), color: '#334155' };
}

export function TeamChip({ sport, name, size = 'md' }: { sport: SportKey; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const t = teamInfo(sport, name);
  const dim = size === 'lg' ? 'h-11 w-11 text-[13px]' : size === 'sm' ? 'h-5 w-5 text-[8px]' : 'h-7 w-7 text-[10px]';
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight text-white ring-1 ring-white/10', dim)}
      style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}aa)` }}
    >
      {t.abbr}
    </span>
  );
}

export function EvBadge({ ev }: { ev: number }) {
  const tone = ev >= 0.03 ? 'pos' : ev >= 0 ? 'info' : 'neutral';
  return <Badge tone={tone} className="num">{`${ev > 0 ? '+' : ''}${(ev * 100).toFixed(1)}%`}</Badge>;
}

export function ProbBar({ a, b, c, colors = ['#34d399', '#60a5fa', '#7c8a9c'] }: { a: number; b: number; c?: number; colors?: string[] }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div style={{ width: `${a * 100}%`, background: colors[0] }} />
      {c !== undefined && <div style={{ width: `${c * 100}%`, background: colors[2] }} />}
      <div style={{ width: `${b * 100}%`, background: colors[1] }} />
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {children && <div className="mt-1 max-w-sm text-xs text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export const chartTooltip = {
  contentStyle: { background: '#0b0f15', border: '1px solid #253041', borderRadius: 10, fontSize: 12, fontFamily: 'JetBrains Mono Variable, monospace', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.6)' },
  labelStyle: { color: '#b4c0cf', marginBottom: 4 },
  itemStyle: { color: '#e7edf5', padding: 0 },
};

export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <th className={clsx('whitespace-nowrap px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.07em] text-muted', right ? 'text-right' : 'text-left', className)}>{children}</th>;
}
export function Td({ children, className, right, mono }: { children?: ReactNode; className?: string; right?: boolean; mono?: boolean }) {
  return <td className={clsx('whitespace-nowrap px-3 py-2.5', right && 'text-right', mono && 'num', className)}>{children}</td>;
}
