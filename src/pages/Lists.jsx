import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, FileSearch, History as HistIcon, Search } from 'lucide-react';
import { api } from '../api';
import { useAuth, useData, useLoad, useToast } from '../state';
import { Badge, Button, EmptyState, ErrorState, Skeleton, StatusBadge } from '../components/ui';
import { useNotifText } from '../components/Shell';
import { useActor, useAuditText, reasonOf } from '../components/ReviewBits';
import { errText, useFmt } from '../lib/fmt';

const Head = ({ title, sub, children }) => <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-serif text-[1.75rem] font-bold">{title}</h1><p className="text-ink-600">{sub}</p></div>{children}</header>;
const Chips = ({ value, onChange, items, label }) => <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">{items.map(([k, text, n]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${value === k ? 'bg-ink-900 text-ivory-50' : 'bg-ivory-200 text-ink-600 hover:bg-ivory-300'}`}>{text}{n != null && <span className="num ml-1.5 opacity-70">{n}</span>}</button>)}</div>;

/* ---------- Document verification ---------- */
export function Documents() {
  const f = useFmt(); const { t } = f; const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(api.documents, []);
  const [flt, setFlt] = useState('all');
  const items = data?.items || [], shown = items.filter((x) => flt === 'all' || x.state === flt), n = (k) => items.filter((x) => x.state === k).length;
  const TONE = { missing: 'brick', unclear: 'warn', unverified: 'slate' };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="space-y-4">
      <Head title={t('documents.title')} sub={t('documents.sub')} />
      <Chips value={flt} onChange={setFlt} label={t('documents.title')} items={[['all', t('documents.filter.all'), items.length], ['missing', t('documents.filter.missing'), n('missing')], ['unclear', t('documents.filter.unclear'), n('unclear')], ['unverified', t('documents.filter.unverified'), n('unverified')]]} />
      <div className="panel overflow-hidden">
        {loading && !data ? <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : shown.length === 0 ? <EmptyState icon={FileSearch} title={t('documents.empty')} text={t('documents.emptyText')} />
          : <ul className="divide-y rule">{shown.map((x, i) => (
            <motion.li key={x.appId + x.doc} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.02 }} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1"><p className="font-medium">{t(`doc.${x.doc}`)}</p><p className="truncate text-[13px] text-ink-400"><span className="num">{x.appId}</span> · {f.L(x.name)} · {f.L(x.village)}</p></div>
              <Badge tone={TONE[x.state]} dot>{x.state === 'unverified' ? t('docStatus.unverified') : t(`docStatus.${x.state}`)}</Badge>
              <Button size="sm" onClick={() => nav(`/applications/${x.appId}?step=documents`)}>{t('documents.open')}</Button>
            </motion.li>))}</ul>}
      </div>
    </div>
  );
}

/* ---------- Tasks ---------- */
export function Tasks() {
  const f = useFmt(); const { t } = f; const { user } = useAuth(); const toast = useToast(); const { refreshBadges } = useData();
  const [scope, setScope] = useState('mine'), [tab, setTab] = useState('open');
  const { data, loading, error, reload } = useLoad(() => api.tasks(scope), [scope]);
  const items = (data?.items || []).filter((x) => (tab === 'open') === !x.done), today = new Date().setHours(0, 0, 0, 0);
  const toggle = async (x) => { try { await api.taskDone(x.id, !x.done); toast.success(t(x.done ? 'tasks.reopenedToast' : 'tasks.completedToast')); reload(); refreshBadges(); } catch (e) { toast.error(errText(t, e)); } };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="space-y-4">
      <Head title={t('tasks.title')} sub={t('tasks.sub')}>{user.role === 'supervisor' && <Chips value={scope} onChange={setScope} label={t('tasks.owner')} items={[['mine', t('tasks.scopeMine')], ['all', t('tasks.scopeAll')]]} />}</Head>
      <Chips value={tab} onChange={setTab} label={t('tasks.title')} items={[['open', t('tasks.open')], ['done', t('tasks.completed')]]} />
      <div className="panel overflow-hidden">
        {loading && !data ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : items.length === 0 ? <EmptyState icon={CheckSquare} title={tab === 'open' ? t('tasks.empty') : t('tasks.emptyDone')} text={tab === 'open' ? t('tasks.emptyText') : undefined} />
          : <ul className="divide-y rule">{items.map((x) => { const late = !x.done && x.dueAt < today; return (
            <li key={x.id} className="flex items-start gap-3 px-4 py-3"><input type="checkbox" className="mt-1.5 h-4 w-4 accent-[#0F1B33]" checked={x.done} onChange={() => toggle(x)} aria-label={f.L(x.title)} />
              <div className="min-w-0 flex-1"><p className={x.done ? 'text-ink-400 line-through' : 'font-medium'}>{f.L(x.title)}</p>
                <p className="text-[13px] text-ink-400">{x.app && <><span className="num">{x.appId}</span> · {f.L(x.app.name)} · </>}{t('drawer.due', { date: f.date(x.dueAt) })}{scope === 'all' && x.ownerName && ` · ${f.L(x.ownerName)}`} {late && <Badge tone="brick">{t('drawer.overdue')}</Badge>}</p></div>
              <Link to={`/applications/${x.appId}`} className="text-sm font-medium text-saffron-700 hover:underline">{t('tasks.openCase')}</Link></li>); })}</ul>}
      </div>
    </div>
  );
}

/* ---------- Decision history (read-only audit) ---------- */
export function DecisionHistory() {
  const f = useFmt(); const { t } = f; const auditText = useAuditText(), actor = useActor();
  const [flt, setFlt] = useState('all'), [q, setQ] = useState(''), [qd, setQd] = useState(''), [page, setPage] = useState(1);
  useEffect(() => { const id = setTimeout(() => { setQd(q); setPage(1); }, 250); return () => clearTimeout(id); }, [q]);
  const actions = flt === 'all' ? 'approved,rejected,returned' : flt;
  const { data, loading, error, reload } = useLoad(() => api.audit({ actions, q: qd, page }), [actions, qd, page]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const TONE = { approved: 'moss', rejected: 'brick', returned: 'warn' };
  return (
    <div className="space-y-4">
      <Head title={t('history.title')} sub={t('history.sub')} />
      <div className="flex flex-wrap items-center gap-3">
        <Chips value={flt} onChange={(v) => { setFlt(v); setPage(1); }} label={t('history.title')} items={['all', 'approved', 'rejected', 'returned'].map((k) => [k, t(`history.filter.${k}`)])} />
        <label className="ml-auto flex w-full items-center gap-2 rounded-lg border border-ivory-300 bg-white px-3 py-1.5 text-sm focus-within:border-saffron-500 sm:w-72"><Search size={15} className="text-ink-400" /><input className="w-full bg-transparent outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('history.search')} aria-label={t('history.search')} /></label>
      </div>
      <div className={`panel overflow-hidden transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
        {!data ? <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div> : data.items.length === 0 ? <EmptyState icon={HistIcon} title={t('history.empty')} text={t('history.emptyText')} />
          : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">{t('history.title')}</caption>
            <thead className="border-b rule bg-ivory-100 text-[12px] font-semibold text-ink-400"><tr>{['when', 'case', 'officer', 'change', 'reason'].map((c) => <th key={c} scope="col" className="px-4 py-2">{t(`history.cols.${c}`)}</th>)}</tr></thead>
            <tbody className="divide-y rule">{data.items.map((e) => (
              <tr key={e.id} className="align-top"><td className="num whitespace-nowrap px-4 py-3 text-ink-600">{f.dateTime(e.at)}</td>
                <td className="px-4 py-3"><Link to={`/applications/${e.appId}`} className="num font-mono text-[13px] font-medium hover:underline">{e.appId}</Link><p className="text-[13px] text-ink-400">{e.app && f.L(e.app.name)}</p></td>
                <td className="px-4 py-3">{actor(e)}</td>
                <td className="px-4 py-3"><span className="flex flex-wrap items-center gap-1.5"><Badge tone="slate">{t(`status.${e.from}`)}</Badge>→<Badge tone={TONE[e.action]}>{t(`status.${e.to}`)}</Badge></span>{e.params?.followedAI != null && <p className="mt-1 text-xs text-ink-400">{t(e.params.followedAI ? 'audit.followedAI' : 'audit.differedAI')}</p>}</td>
                <td className="max-w-[320px] px-4 py-3 text-ink-600">{reasonOf(e, t) || <span className="text-ink-300">{t('history.noReason')}</span>}</td></tr>))}</tbody></table></div>}
      </div>
      <div className="flex items-center justify-between text-sm text-ink-600"><p className="text-xs text-ink-400">{t('history.immutable')}</p>
        {data && data.pages > 1 && <div className="flex items-center gap-2"><Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('common.previous')} /><span className="num">{t('common.page', { page: data.page, pages: data.pages })}</span><Button size="sm" icon={ChevronRight} disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label={t('common.next')} /></div>}</div>
    </div>
  );
}

/* ---------- Notifications ---------- */
export function Notifications() {
  const f = useFmt(); const { t } = f; const nav = useNavigate(); const text = useNotifText(); const { refreshBadges } = useData();
  const { data, loading, error, reload } = useLoad(api.notifications, []);
  const [tab, setTab] = useState('all');
  const items = (data?.items || []).filter((n) => tab === 'all' || !n.read);
  const ICON = { new: 'bg-ink-600', deadline: 'bg-warn-600', overdue: 'bg-brick-600', resubmitted: 'bg-saffron-500', task_due: 'bg-warn-600', task_overdue: 'bg-brick-600', status: 'bg-moss-600' };
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <div className="space-y-4">
      <Head title={t('notifications.title')} sub={t('notifications.sub')}><Button size="sm" icon={CheckCircle2} onClick={async () => { await api.readNotifs({ all: true }); reload(); refreshBadges(); }} disabled={!data?.unread}>{t('notifications.markAll')}</Button></Head>
      <Chips value={tab} onChange={setTab} label={t('notifications.title')} items={[['all', t('notifications.all'), data?.items.length], ['unread', t('notifications.unread'), data?.unread]]} />
      <div className="panel overflow-hidden">
        {loading && !data ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : items.length === 0 ? <EmptyState icon={Bell} title={t('notifications.empty')} text={t('notifications.emptyText')} />
          : <ul className="divide-y rule">{items.map((n) => (
            <li key={n.id}><button className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ivory-100" onClick={async () => { await api.readNotifs({ ids: [n.id] }); refreshBadges(); nav(`/applications/${n.appId}`); }}>
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-ivory-300' : ICON[n.type]}`} /><span className="flex-1"><span className={`block text-[14.5px] ${n.read ? 'text-ink-600' : 'font-medium'}`}>{text(n)}</span><span className="block text-xs text-ink-400">{n.appId} · {f.rel(n.at)}</span></span>
              {!n.read && <Badge tone="saffron">{t('notifications.unread')}</Badge>}</button></li>))}</ul>}
      </div>
    </div>
  );
}
