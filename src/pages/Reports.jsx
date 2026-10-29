import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip as RTip, XAxis, YAxis } from 'recharts';
import { motion, useReducedMotion } from 'framer-motion';
import { Download } from 'lucide-react';
import { api } from '../api';
import { useLoad, useToast } from '../state';
import { Button, ErrorState, Skeleton } from '../components/ui';
import { download } from '../components/CaseBits';
import { errText, useFmt } from '../lib/fmt';

const iso = (d) => new Date(d - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const AGING = { ok: '#9AA8C4', mid: '#3B4D74', high: '#E8832A', late: '#B4382B' };
const tick = { fontSize: 12, fill: '#475569' };
const Card = ({ title, sub, children, className = '' }) => <section className={`panel p-5 ${className}`}><h2 className="font-semibold">{title}</h2>{sub && <p className="mb-3 text-[12.5px] text-ink-400">{sub}</p>}<div className={sub ? '' : 'mt-3'}>{children}</div></section>;
const ChartTip = ({ active, payload, label }) => (active && payload?.length ? <div className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs text-ivory-50 shadow-pop"><p className="mb-0.5 font-semibold">{label}</p>{payload.map((p) => <p key={p.dataKey}>{p.name}: <b>{p.value}</b></p>)}</div> : null);

function HBars({ rows, color = '#0F1B33' }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return <ul className="space-y-2.5">{rows.map((r) => <li key={r.label} className="text-sm"><div className="mb-1 flex justify-between"><span>{r.label}</span><span className="num font-semibold">{r.count}</span></div><div className="h-2 rounded-full bg-ivory-200"><motion.div className="h-full rounded-full" style={{ background: r.color || color }} initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ duration: 0.4 }} /></div></li>)}</ul>;
}

export default function Reports() {
  const f = useFmt(); const { t } = f; const toast = useToast(); const reduce = useReducedMotion();
  const [preset, setPreset] = useState('90'), [custom, setCustom] = useState({ from: '', to: '' });
  const range = useMemo(() => (preset === 'custom' ? custom : { from: iso(Date.now() - (+preset - 1) * 864e5), to: iso(Date.now()) }), [preset, custom]);
  const { data: d, loading, error, reload } = useLoad(() => api.reports(range), [range.from, range.to]);
  const exportCsv = async () => { try { download(await api.exportCsv({ ...range, lang: f.lang }), 'jansewa-report.csv'); } catch (e) { toast.error(errText(t, e)); } };
  if (error && !d) return <ErrorState error={error} onRetry={reload} />;
  const colors = { pending: '#A8700A', returned: '#9AA8C4', approved: '#2F7A4F', rejected: '#B4382B' };
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-serif text-[1.75rem] font-bold">{t('reports.title')}</h1><p className="text-ink-600">{t('reports.sub')}</p></div><Button icon={Download} onClick={exportCsv}>{t('reports.export')}</Button></header>
      <div className="flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label={t('reports.range')} className="flex gap-1.5">{[['30', 'last30'], ['90', 'last90'], ['180', 'last180'], ['custom', 'custom']].map(([k, l]) => <button key={k} role="tab" aria-selected={preset === k} onClick={() => setPreset(k)} className={`rounded-full px-3 py-1 text-[13px] font-medium ${preset === k ? 'bg-ink-900 text-ivory-50' : 'bg-ivory-200 text-ink-600 hover:bg-ivory-300'}`}>{t(`reports.${l}`)}</button>)}</div>
        {preset === 'custom' && <><label className="text-[13px]">{t('common.from')}<input type="date" className="input ml-2 !w-auto !py-1" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label><label className="text-[13px]">{t('common.to')}<input type="date" className="input ml-2 !w-auto !py-1" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label></>}
        <p className="text-xs text-ink-400">{t('reports.exportHint')}</p>
      </div>
      {!d ? <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div> : (
        <div className={`grid gap-4 transition-opacity lg:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
          <Card className="lg:col-span-2" title={t('reports.volume')} sub={t('reports.volumeSub', { count: d.step })}>
            <div className="h-64" role="img" aria-label={t('reports.volume')}><ResponsiveContainer width="100%" height="100%"><BarChart data={d.volume.map((v) => ({ ...v, label: f.short(v.date) }))} margin={{ left: -18, right: 6, top: 6 }}><CartesianGrid vertical={false} stroke="#E0D8C3" /><XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} minTickGap={16} /><YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} /><RTip content={<ChartTip />} cursor={{ fill: 'rgba(15,27,51,.05)' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="received" name={t('reports.received')} fill="#243659" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} animationDuration={500} /><Bar dataKey="decided" name={t('reports.decided')} fill="#E8832A" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} animationDuration={500} /></BarChart></ResponsiveContainer></div>
          </Card>
          <Card title={t('reports.byType')}><HBars rows={d.byType.map((x) => ({ label: t(`type.${x.key}`), count: x.count }))} /></Card>
          <Card title={t('reports.byStatus')}><HBars rows={d.byStatus.map((x) => ({ label: t(`status.${x.key}`), count: x.count, color: colors[x.key] }))} /></Card>
          <Card title={t('reports.processing')} sub={t('reports.decidedCount', { count: d.processing.count })}>
            <div className="grid grid-cols-2 gap-4"><div><p className="eyebrow">{t('reports.avg')}</p><p className="num font-serif text-4xl font-bold">{d.processing.avg ?? t('reports.na')}</p></div><div><p className="eyebrow">{t('reports.withinSla', { days: d.sla })}</p><p className="num font-serif text-4xl font-bold">{d.processing.withinSla != null ? `${d.processing.withinSla}%` : t('reports.na')}</p></div></div>
            <ul className="mt-3 space-y-1 text-sm">{d.processing.byType.map((x) => <li key={x.key} className="flex justify-between border-t rule pt-1"><span>{t(`type.${x.key}`)}</span><span className="num font-semibold">{x.avg != null ? t('reports.days', { count: x.avg }) : t('reports.na')}</span></li>)}</ul>
            <p className="mt-2 text-xs text-ink-400">{t('reports.slaNote')}</p></Card>
          <Card title={t('reports.aging')} sub={t('reports.agingSub')}>
            <div className="h-44" role="img" aria-label={t('reports.aging')}><ResponsiveContainer width="100%" height="100%"><BarChart data={d.aging} layout="vertical" margin={{ left: 0, right: 24 }}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="label" width={56} tick={tick} axisLine={false} tickLine={false} /><RTip content={<ChartTip />} cursor={{ fill: 'rgba(15,27,51,.05)' }} />
              <Bar dataKey="count" name={t('reports.pending')} barSize={18} radius={[0, 5, 5, 0]} isAnimationActive={!reduce} animationDuration={500} label={{ position: 'right', ...tick, fontWeight: 600 }}>{d.aging.map((a) => <Cell key={a.label} fill={AGING[a.tone]} />)}</Bar></BarChart></ResponsiveContainer></div></Card>
          <Card title={t('reports.returns')}><dl className="grid grid-cols-2 gap-3">{['returned', 'resubmitted', 'awaiting', 'repeat'].map((k) => <div key={k} className="rounded-lg bg-ivory-100 p-3"><dt className="text-[12.5px] text-ink-600">{t(`reports.${k}`)}</dt><dd className="num font-serif text-3xl font-bold">{d.returns[k]}</dd></div>)}</dl></Card>
          <Card title={t('reports.workload')} sub={t('reports.workloadSub')}>
            <table className="w-full text-sm"><thead className="text-left text-[12px] text-ink-400"><tr><th scope="col" className="py-1" /><th scope="col" className="py-1 text-right">{t('reports.pending')}</th><th scope="col" className="py-1 text-right">{t('reports.overdue')}</th></tr></thead>
              <tbody>{d.workload.map((w) => <tr key={w.id || 'none'} className="border-t rule"><th scope="row" className="py-2 text-left font-medium">{w.name ? f.L(w.name) : t('reports.unassigned')}</th><td className="num py-2 text-right">{w.pending}</td><td className={`num py-2 text-right ${w.overdue ? 'font-semibold text-brick-700' : ''}`}>{w.overdue}</td></tr>)}</tbody></table></Card>
        </div>)}
    </div>
  );
}
