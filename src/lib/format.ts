import { decimalToAmerican, fmtAmerican } from './odds';
import { useStore } from './store';

export const pct = (x: number, d = 1) => (isFinite(x) ? `${(x * 100).toFixed(d)}%` : '—');
export const spct = (x: number, d = 1) => (isFinite(x) ? `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%` : '—');
export const money = (x: number, d = 0) =>
  isFinite(x) ? `${x < 0 ? '−' : ''}$${Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })}` : '—';
export const smoney = (x: number, d = 0) => (x > 0 ? '+' : '') + money(x, d);
export const num = (x: number, d = 1) => (isFinite(x) ? x.toFixed(d) : '—');
export const snum = (x: number, d = 1) => (isFinite(x) ? `${x > 0 ? '+' : ''}${x.toFixed(d)}` : '—');

export function fmtOdds(decimal: number, format: 'american' | 'decimal') {
  if (!isFinite(decimal) || decimal <= 1) return '—';
  return format === 'decimal' ? decimal.toFixed(2) : fmtAmerican(decimalToAmerican(decimal));
}

export function useOdds() {
  const f = useStore((s) => s.oddsFormat);
  return (d: number) => fmtOdds(d, f);
}

export const shortName = (s: string) => {
  const parts = s.split(' ');
  if (parts.length === 1) return s;
  // "Manchester United" → "Man United" style is overkill; nickname is usually last word for US leagues
  return ['United', 'City', 'Hotspur', 'Forest', 'Villa', 'Palace', 'Albion', 'Wanderers'].includes(parts[parts.length - 1]) ? parts.slice(0, 2).join(' ') : parts[parts.length - 1];
};
