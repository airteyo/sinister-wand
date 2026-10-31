import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { useEng } from '../components/EngineContext';
import { Card, chartTooltip, Empty, PageHeader, Segmented, TeamChip, Td, teamInfo, Th } from '../components/ui';
import { num, snum } from '../lib/format';
import { SPORTS } from '../lib/sports';
import type { TeamRating } from '../lib/types';

function Spark({ data, color }: { data: { day: number; net: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-7 w-28">
      <ResponsiveContainer>
        <LineChart data={data.slice(-40)} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="net" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Ratings() {
  const eng = useEng();
  const cfg = SPORTS[eng.sport];
  const [sort, setSort] = useState<'net' | 'off' | 'def'>('net');
  const d = cfg.scoreModel === 'margin' ? 1 : 2;
  const scale = (t: TeamRating, k: 'off' | 'def') => (cfg.scoreModel === 'margin' ? t[k] : cfg.avgScore * (k === 'off' ? Math.exp(t.off) - 1 : 1 - Math.exp(-t.def)));
  const rows = useMemo(() => [...eng.model.teams.values()].sort((a, b) => (sort === 'net' ? b.net - a.net : scale(b, sort) - scale(a, sort))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eng.model, sort]);

  if (!eng.hasModel || !rows.length) return <><PageHeader title="Power ratings" /><Card><Empty title="No ratings yet">Import historical results for this league in Settings to build ratings in live mode.</Empty></Card></>;

  const maxNet = Math.max(...rows.map((r) => Math.abs(r.net)));
  const scatter = rows.map((t) => ({ name: t.team, off: scale(t, 'off'), def: scale(t, 'def'), color: teamInfo(eng.sport, t.team).color }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Power ratings"
        subtitle={`${cfg.league} · Kalman-filtered offense/defense ratings · ${cfg.scoreModel === 'margin' ? 'points' : cfg.scoreUnit} per game vs an average team on a neutral site`}
        right={<Segmented value={sort} onChange={setSort} options={[{ value: 'net', label: 'Net' }, { value: 'off', label: 'Offense' }, { value: 'def', label: 'Defense' }]} />}
      />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="border-b border-line bg-panel-2/50"><tr><Th>#</Th><Th>Team</Th><Th right>Record</Th><Th right>Off</Th><Th right>Def</Th><Th>Net</Th><Th right>±95%</Th><Th>Trend</Th></tr></thead>
              <tbody>
                {rows.map((t, i) => {
                  const ci = 1.96 * Math.sqrt(t.pOff + t.pDef) * (cfg.scoreModel === 'margin' ? 1 : cfg.avgScore);
                  return (
                    <tr key={t.team} className="border-b border-line/50 last:border-0 hover:bg-panel-2/40">
                      <Td mono className="text-faint">{i + 1}</Td>
                      <Td><div className="flex items-center gap-2.5"><TeamChip sport={eng.sport} name={t.team} size="sm" /><span className="font-medium">{t.team}</span></div></Td>
                      <Td right mono className="text-fg-2">{t.w}-{t.l}{t.t ? `-${t.t}` : ''}</Td>
                      <Td right mono className={scale(t, 'off') >= 0 ? 'text-pos' : 'text-neg'}>{snum(scale(t, 'off'), d)}</Td>
                      <Td right mono className={scale(t, 'def') >= 0 ? 'text-pos' : 'text-neg'}>{snum(scale(t, 'def'), d)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 w-24 rounded-full bg-line">
                            <div className="absolute top-0 left-1/2 h-full w-px bg-line-2" />
                            <div className={clsx('absolute top-0 h-full rounded-full', t.net >= 0 ? 'bg-pos' : 'bg-neg')} style={{ left: t.net >= 0 ? '50%' : `${50 - (Math.abs(t.net) / maxNet) * 50}%`, width: `${(Math.abs(t.net) / maxNet) * 50}%` }} />
                          </div>
                          <span className="num w-12 font-semibold">{snum(t.net, d)}</span>
                        </div>
                      </Td>
                      <Td right mono className="text-muted">{num(ci, d)}</Td>
                      <Td><Spark data={t.history} color={t.net >= 0 ? '#34d399' : '#f87171'} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Offense vs defense" subtitle="Top-right = elite on both sides">
          <div className="h-[360px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -12 }}>
                <CartesianGrid strokeDasharray="2 4" />
                <XAxis type="number" dataKey="off" name="Offense" tickLine={false} axisLine={false} tickFormatter={(v) => num(v, d)} label={{ value: 'Offense →', position: 'insideBottomRight', offset: -4, fill: '#7c8a9c', fontSize: 10 }} />
                <YAxis type="number" dataKey="def" name="Defense" tickLine={false} axisLine={false} tickFormatter={(v) => num(v, d)} />
                <ZAxis range={[60, 60]} />
                <ReferenceLine x={0} stroke="#253041" />
                <ReferenceLine y={0} stroke="#253041" />
                <Tooltip {...chartTooltip} cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                  const p = payload?.[0]?.payload as (typeof scatter)[number] | undefined;
                  return p ? <div style={chartTooltip.contentStyle} className="px-3 py-2"><div className="font-sans text-xs font-semibold">{p.name}</div><div className="text-[11px] text-fg-2">Off {snum(p.off, d)} · Def {snum(p.def, d)}</div></div> : null;
                }} />
                <Scatter data={scatter} shape={(props: { cx?: number; cy?: number; payload?: { color: string } }) => <circle cx={props.cx} cy={props.cy} r={6} fill={props.payload?.color} stroke="#fff" strokeOpacity={0.4} />} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
