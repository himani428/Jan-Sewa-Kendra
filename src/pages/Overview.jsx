import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, History as HistIcon, CheckSquare } from 'lucide-react';
import { api } from '../api';
import { useAuth, useLoad } from '../state';
import { Num, Skeleton, ErrorState, EmptyState, Button, Tooltip } from '../components/ui';
import { WhyChips } from '../components/CaseBits';
import { useFmt, urgencyTone, resume } from '../lib/fmt';

const rise = (i = 0) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.24, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] } });
const MARK = { brick: 'bg-brick-600', warn: 'bg-warn-600', slate: 'bg-ink-300' };

export default function Overview() {
  const f = useFmt(); const { t } = f; const { user } = useAuth(); const nav = useNavigate();
  const { data: d, error, reload } = useLoad(api.overview, []);
  const hour = new Date().getHours(), greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const first = f.L(user.name).replace(/^(श्री|श्रीमती|Shri|Smt\.)\s*/, '');
  const r = resume.get(), maxBar = Math.max(1, ...(d?.deadlines.map((x) => x.count) || [1]));
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const stats = d && [
    { k: 'pending', v: d.pending, to: '/queue?view=mine', big: true }, { k: 'urgent', v: d.urgent, to: '/queue?view=urgent', tone: d.urgent ? 'text-warn-700' : '' },
    { k: 'overdue', v: d.overdue, to: '/queue?view=overdue', tone: d.overdue ? 'text-brick-700' : '' }, { k: 'ready', v: d.ready, to: '/queue?view=ready', tone: 'text-moss-700' },
  ];
  return (
    <div className="space-y-6">
      <motion.header {...rise(0)}>
        <p className="eyebrow">{f.L(user.office)} · {f.date(Date.now())}</p>
        <h1 className="mt-1 font-serif text-[1.75rem] font-bold">{t(`greeting.${greet}`)}, {first}</h1>
        {d ? <p className="text-ink-600">{d.pending ? t('overview.summary', { count: d.pending }) : t('overview.summaryNone')}</p> : <Skeleton className="mt-1 h-5 w-72" />}
      </motion.header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-6">
          <motion.section {...rise(1)} className="panel grid grid-cols-2 divide-x divide-y rule sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:divide-y-0" aria-label={t('overview.title')}>
            {!d ? [0, 1, 2, 3].map((i) => <div key={i} className="p-5"><Skeleton className="h-14" /></div>) : stats.map((s) => (
              <Tooltip key={s.k} text={t(`overview.${s.k}Hint`, { days: d.sla })}>
                <Link to={s.to} className="group block w-full p-4 transition-colors hover:bg-ivory-100 sm:p-5">
                  <p className="eyebrow">{t(`overview.${s.k}`)}</p>
                  <p className={`mt-1 font-serif font-bold leading-none ${s.big ? 'text-[3.2rem]' : 'text-[2.2rem]'} ${s.tone || ''}`}><Num value={s.v} /></p>
                </Link>
              </Tooltip>))}
          </motion.section>

          <motion.section {...rise(2)} aria-labelledby="needs-h">
            <div className="mb-2 flex items-end justify-between"><div><h2 id="needs-h" className="font-serif text-xl font-bold">{t('overview.needs')}</h2><p className="text-[13px] text-ink-400">{t('overview.needsSub')}</p></div>
              <Link to="/queue" className="text-sm font-medium text-saffron-700 hover:underline underline-offset-4">{t('overview.viewAll')} →</Link></div>
            <div className="panel overflow-hidden">
              {!d ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
                : d.attention.length === 0 ? <EmptyState icon={CheckCircle2} title={t('overview.emptyTitle')} text={t('overview.emptyText')} action={<Button variant="primary" onClick={() => nav('/queue')}>{t('overview.emptyCta')}</Button>} />
                : <ul className="divide-y rule">{d.attention.map((m, i) => (
                  <motion.li key={m.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.2 }}>
                    <Link to={`/applications/${m.id}`} className="group relative flex items-center gap-4 py-3.5 pl-5 pr-4 transition-colors hover:bg-ivory-100">
                      <span className={`absolute inset-y-0 left-0 w-1 ${MARK[m.status === 'pending' ? urgencyTone(m.daysLeft) : 'slate']}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{f.L(m.name)}</span><span className="num text-[12.5px] text-ink-400">{m.id} · {t(`type.${m.type}`)}</span></p>
                        <p className="text-[14px] text-ink-700">{t(`next.${m.nextAction}`)} <span className="text-ink-400">— {t(`next.why.${m.nextAction}`)}</span></p>
                        <div className="mt-1.5"><WhyChips why={m.why} /></div>
                      </div>
                      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-ink-600 group-hover:text-saffron-700 sm:inline-flex">{t('queue.open')}<ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
                    </Link>
                  </motion.li>))}</ul>}
            </div>
            {d && d.needsAttentionTotal > d.attention.length && <p className="mt-2 text-[13px] text-ink-400">{t('overview.more', { count: d.needsAttentionTotal - d.attention.length })}</p>}
          </motion.section>
        </div>

        <aside className="space-y-6">
          <motion.section {...rise(3)} className="panel p-5" aria-labelledby="dl-h">
            <h2 id="dl-h" className="font-semibold">{t('overview.deadlines')}</h2><p className="mb-3 text-[12.5px] text-ink-400">{t('overview.deadlinesSub')}</p>
            {!d ? <Skeleton className="h-36" /> : (<>
              <div className="flex h-28 items-end gap-1" role="list">
                {d.deadlines.map((x) => (
                  <Tooltip key={x.offset} text={`${f.short(x.date)} · ${t('overview.cases', { count: x.count })}`}>
                    <button role="listitem" disabled={!x.count} onClick={() => nav(`/queue?view=mine&dueOn=${x.offset}`)} aria-label={`${f.short(x.date)}: ${t('overview.cases', { count: x.count })}`} className="group flex h-full w-full flex-col items-center justify-end gap-1 disabled:cursor-default">
                      <span className="num text-[10px] font-semibold text-ink-600">{x.count || ''}</span>
                      <motion.span initial={{ height: 0 }} animate={{ height: x.count ? `${20 + (x.count / maxBar) * 62}%` : 2 }} transition={{ duration: 0.4, delay: 0.1 + x.offset * 0.02 }} className={`w-full rounded-sm ${x.count ? (x.offset <= 5 ? 'bg-saffron-500 group-hover:bg-saffron-600' : 'bg-ink-300 group-hover:bg-ink-600') : 'bg-ivory-300'}`} />
                    </button>
                  </Tooltip>))}
              </div>
              <div className="mt-1 flex gap-1 text-[10px] text-ink-400" aria-hidden>{d.deadlines.map((x) => <span key={x.offset} className="num w-full text-center">{x.offset === 0 ? t('time.today').slice(0, 5) : new Date(x.date).getDate()}</span>)}</div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {d.overdue > 0 && <Link to="/queue?view=overdue" className="font-medium text-brick-700 hover:underline">{t('overview.late')}: {d.overdue}</Link>}
                <span className="text-ink-400">{t('overview.later')}: {d.laterCount}</span>
              </div></>)}
          </motion.section>

          {(r || (d && d.tasksOpen > 0)) && (
            <motion.section {...rise(4)} className="panel divide-y rule">
              {r && <Link to={`/applications/${r.id}?step=${r.step}`} className="flex items-start gap-3 p-4 hover:bg-ivory-100"><HistIcon size={17} className="mt-1 text-saffron-600" /><span className="text-sm"><span className="block font-semibold">{t('overview.resume')}</span><span className="text-ink-600">{t('overview.resumeText', { id: r.id, name: f.L(r.name), step: t(`review.steps.${r.step}`) })}</span></span></Link>}
              {d && d.tasksOpen > 0 && <Link to="/tasks" className="flex items-start gap-3 p-4 hover:bg-ivory-100"><CheckSquare size={17} className="mt-1 text-saffron-600" /><span className="text-sm"><span className="block font-semibold">{t('overview.tasks')}</span><span className="text-ink-600">{t('overview.tasksText', { count: d.tasksOpen })}{d.tasksOverdue > 0 && <span className="text-brick-700"> · {t('overview.tasksOverdue', { count: d.tasksOverdue })}</span>}</span></span></Link>}
            </motion.section>)}
        </aside>
      </div>
    </div>
  );
}
