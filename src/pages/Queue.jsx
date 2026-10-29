import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, SlidersHorizontal, Bookmark, Pencil, Trash2, Check, X, UserPlus, Download, ListPlus, ListMinus, ChevronLeft, ChevronRight, Inbox, ShieldAlert } from 'lucide-react';
import { api, qs } from '../api';
import { useData, useToast } from '../state';
import { Badge, Button, EmptyState, ErrorState, HelpTip, Popover, Skeleton, StatusBadge } from '../components/ui';
import { Deadline, WhyChips, download } from '../components/CaseBits';
import { errText, useFmt, urgencyTone } from '../lib/fmt';

const TABS = ['mine', 'urgent', 'docs', 'ready', 'overdue', 'returned'];
const FILTER_KEYS = ['q', 'type', 'status', 'urgency', 'missing', 'due', 'dueOn', 'from', 'to', 'assignee', 'queued'];
const MARK = { brick: 'bg-brick-600', warn: 'bg-warn-600', slate: 'bg-transparent' };

function SavedViews({ sp, apply }) {
  const f = useFmt(); const { t } = f; const toast = useToast();
  const [items, setItems] = useState([]), [name, setName] = useState(''), [edit, setEdit] = useState(null);
  const load = useCallback(() => api.views().then((r) => setItems(r.items)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const current = () => Object.fromEntries([...sp.entries()].filter(([k, v]) => k !== 'page' && v));
  const label = (v) => (v.nameKey ? t(v.nameKey) : v.name);
  const save = async () => { if (!name.trim()) return; try { setItems((await api.addView({ name, params: current() })).items); setName(''); toast.success(t('queue.saved.saved')); } catch (e) { toast.error(errText(t, e)); } };
  return (
    <Popover label={t('queue.saved.title')} align="left" width="w-80" trigger={({ toggle, ...p }) => <Button size="sm" icon={Bookmark} onClick={toggle} {...p}>{t('queue.saved.title')}</Button>}>
      {(close) => (
        <div className="text-sm">
          <ul className="max-h-56 overflow-y-auto py-1">
            {items.length === 0 && <li className="px-4 py-3 text-ink-400">{t('queue.saved.none')}</li>}
            {items.map((v) => (
              <li key={v.id} className="flex items-center gap-1 px-2">
                {edit?.id === v.id ? (
                  <form className="flex flex-1 items-center gap-1 py-1" onSubmit={async (e) => { e.preventDefault(); try { setItems((await api.renameView(v.id, edit.name)).items); toast.success(t('queue.saved.renamed')); } catch (x) { toast.error(errText(t, x)); } setEdit(null); }}>
                    <input data-autofocus className="input !py-1" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label={t('queue.saved.name')} /><button aria-label={t('common.save')} className="p-1.5 text-moss-700"><Check size={15} /></button>
                  </form>) : (<>
                  <button className="flex-1 rounded-md px-2 py-2 text-left hover:bg-ivory-100" onClick={() => { apply(v.params); close(); }}>{label(v)}</button>
                  <button className="p-1.5 text-ink-400 hover:text-ink-900" aria-label={t('queue.saved.renameAria', { name: label(v) })} onClick={() => setEdit({ id: v.id, name: label(v) })}><Pencil size={14} /></button>
                  <button className="p-1.5 text-ink-400 hover:text-brick-700" aria-label={t('queue.saved.removeAria', { name: label(v) })} onClick={async () => { setItems((await api.delView(v.id)).items); toast.success(t('queue.saved.removed')); }}><Trash2 size={14} /></button></>)}
              </li>))}
          </ul>
          <form className="flex gap-2 border-t rule p-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <input className="input !py-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('queue.saved.name')} aria-label={t('queue.saved.name')} maxLength={40} />
            <Button size="sm" variant="primary" type="submit" disabled={!name.trim()}>{t('common.save')}</Button>
          </form>
          <p className="px-3 pb-3 text-xs text-ink-400">{t('queue.saved.save')}</p>
        </div>)}
    </Popover>
  );
}

export default function Queue({ mode }) {
  const f = useFmt(); const { t } = f; const nav = useNavigate(); const toast = useToast(); const { officers, refreshBadges, officerName } = useData();
  const [sp, setSp] = useSearchParams();
  const all = mode === 'all', view = all ? 'all' : TABS.includes(sp.get('view')) ? sp.get('view') : 'mine';
  const [state, setState] = useState({ loading: true, error: null, data: null }), [open, setOpen] = useState(false), [sel, setSel] = useState(new Set()), [active, setActive] = useState(-1), [qText, setQText] = useState(sp.get('q') || '');
  const query = useMemo(() => ({ ...Object.fromEntries(sp.entries()), view, pageSize: 10 }), [sp, view]);
  const key = qs(query);
  const load = useCallback(() => { setState((s) => ({ ...s, loading: true, error: null })); return api.list(key).then((data) => setState({ loading: false, error: null, data })).catch((error) => setState((s) => ({ ...s, loading: false, error }))); }, [key]);
  useEffect(() => { load(); setSel(new Set()); setActive(-1); }, [load]);
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || v === false ? n.delete(k) : n.set(k, v === true ? '1' : v))); if (!('page' in patch)) n.delete('page'); setSp(n, { replace: true }); };
  useEffect(() => { const id = setTimeout(() => qText !== (sp.get('q') || '') && set({ q: qText }), 250); return () => clearTimeout(id); }, [qText]); // eslint-disable-line
  useEffect(() => { setQText(sp.get('q') || ''); }, [sp.get('q')]); // eslint-disable-line
  const nFilters = FILTER_KEYS.filter((k) => k !== 'q' && sp.get(k)).length;
  const items = state.data?.items || [];
  const clear = () => { const n = new URLSearchParams(); if (!all && sp.get('view')) n.set('view', sp.get('view')); setSp(n, { replace: true }); setQText(''); };
  const applyView = (params) => { setSp(new URLSearchParams(params), { replace: true }); setQText(params.q || ''); };

  useEffect(() => {
    const k = (e) => {
      const el = document.activeElement;
      if ((el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)) || document.querySelector('[aria-modal="true"]') || e.ctrlKey || e.metaKey) return;
      if (e.key === 'j') setActive((a) => Math.min(a + 1, items.length - 1)); else if (e.key === 'k') setActive((a) => Math.max(a - 1, 0));
      else if (e.key === 'Enter' && active >= 0 && items[active] && el?.tagName !== 'A' && el?.tagName !== 'BUTTON') nav(`/applications/${items[active].id}`);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [items, active, nav]);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = items.length > 0 && items.every((m) => sel.has(m.id));
  const bulk = async (action, assignee) => {
    try { const r = await api.bulk({ ids: [...sel], action, assignee }); toast.success(t('queue.bulk.done', { count: r.changed })); setSel(new Set()); load(); refreshBadges(); } catch (e) { toast.error(errText(t, e)); }
  };
  const exportSel = async () => { try { download(await api.exportCsv({ ids: [...sel].join(','), lang: f.lang }), 'jansewa-applications.csv'); } catch (e) { toast.error(errText(t, e)); } };
  const counts = state.data?.counts || {};

  return (
    <div className="space-y-4">
      <header><h1 className="font-serif text-[1.75rem] font-bold">{all ? t('queue.allTitle') : t('queue.title')}</h1><p className="text-ink-600">{all ? t('queue.allSubtitle') : t('queue.subtitle')}</p></header>

      {!all && (
        <div role="tablist" aria-label={t('queue.title')} className="-mx-1 flex gap-1 overflow-x-auto border-b rule px-1">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => set({ view: k === 'mine' ? '' : k, due: '', dueOn: '' })} className={`relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium ${view === k ? 'text-ink-900' : 'text-ink-400 hover:text-ink-900'}`}>
              {t(`queue.tabs.${k}`)}<span className={`num rounded-full px-1.5 text-xs ${view === k ? 'bg-ink-900 text-ivory-50' : 'bg-ivory-300 text-ink-600'}`}>{counts[k] ?? '·'}</span>
              {view === k && <motion.span layoutId="queue-tab" className="absolute inset-x-0 -bottom-px h-[2px] bg-saffron-500" transition={{ duration: 0.18 }} />}
            </button>))}
        </div>)}
      {!all && <p className="flex items-center gap-1.5 text-[13px] text-ink-400">{t(`queue.tabHelp.${view}`)}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-ivory-300 bg-white px-3 py-1.5 text-sm focus-within:border-saffron-500 sm:max-w-sm">
          <Search size={15} className="text-ink-400" /><input value={qText} onChange={(e) => setQText(e.target.value)} placeholder={t('queue.search')} aria-label={t('queue.search')} className="w-full bg-transparent outline-none" />
          {qText && <button onClick={() => setQText('')} aria-label={t('common.clear')} className="text-ink-400"><X size={14} /></button>}
        </label>
        <Button size="sm" icon={SlidersHorizontal} onClick={() => setOpen(!open)} aria-expanded={open}>{nFilters ? t('queue.filtersActive', { count: nFilters }) : t('queue.filters')}</Button>
        <SavedViews sp={sp} apply={applyView} />
        {(nFilters > 0 || sp.get('q')) && <button onClick={clear} className="text-[13px] font-medium text-saffron-700 hover:underline">{t('common.clearFilters')}</button>}
        <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-600">{t('queue.f.sort')}
          <select className="input !w-auto !py-1.5" value={sp.get('sort') || 'priority'} onChange={(e) => set({ sort: e.target.value === 'priority' ? '' : e.target.value })}>{['priority', 'deadline', 'age', 'id', 'name'].map((s) => <option key={s} value={s}>{t(`queue.sort.${s}`)}</option>)}</select></label>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[13px] font-medium">{t('queue.f.type')}<select className="input mt-1" value={sp.get('type') || ''} onChange={(e) => set({ type: e.target.value })}><option value="">{t('common.all')}</option><option value="sale">{t('type.sale')}</option><option value="inheritance">{t('type.inheritance')}</option></select></label>
              {all && <label className="text-[13px] font-medium">{t('queue.f.status')}<select className="input mt-1" value={sp.get('status') || ''} onChange={(e) => set({ status: e.target.value })}><option value="">{t('common.all')}</option>{['pending', 'returned', 'approved', 'rejected'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></label>}
              <label className="text-[13px] font-medium">{t('queue.f.due')}<select className="input mt-1" value={sp.get('due') || ''} onChange={(e) => set({ due: e.target.value, dueOn: '' })}><option value="">{t('common.all')}</option>{[7, 14, 30].map((d) => <option key={d} value={d}>{t('queue.f.dueDays', { count: d })}</option>)}</select></label>
              {all && <label className="text-[13px] font-medium">{t('queue.f.assignee')}<select className="input mt-1" value={sp.get('assignee') || ''} onChange={(e) => set({ assignee: e.target.value })}><option value="">{t('common.all')}</option><option value="me">{t('queue.f.me')}</option><option value="none">{t('queue.f.unassigned')}</option>{officers.map((o) => <option key={o.id} value={o.id}>{f.L(o.name)}</option>)}</select></label>}
              <label className="text-[13px] font-medium">{t('queue.f.from')}<input type="date" className="input mt-1" value={sp.get('from') || ''} onChange={(e) => set({ from: e.target.value })} /></label>
              <label className="text-[13px] font-medium">{t('queue.f.to')}<input type="date" className="input mt-1" value={sp.get('to') || ''} onChange={(e) => set({ to: e.target.value })} /></label>
              <div className="flex flex-col justify-end gap-2 text-sm sm:col-span-2">
                {[['urgency', 'urgent', 'high'], ['missing', 'missing', '1'], ['queued', 'queued', '1']].map(([k, label, v]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0F1B33]" checked={sp.get(k) === v} onChange={(e) => set({ [k]: e.target.checked ? v : '' })} />{t(`queue.f.${label}`)}</label>)}
              </div>
            </div>
          </motion.div>)}
      </AnimatePresence>

      {state.error && !state.data ? <ErrorState error={state.error} onRetry={load} /> : (
        <div className={`panel overflow-hidden transition-opacity ${state.loading && state.data ? 'opacity-60' : ''}`} aria-busy={state.loading}>
          <div className="hidden grid-cols-[28px_130px_minmax(0,1.2fr)_120px_130px_minmax(0,1.3fr)] items-center gap-3 border-b rule bg-ivory-100 px-4 py-2 text-[12px] font-semibold text-ink-400 md:grid">
            <input type="checkbox" className="h-4 w-4 accent-[#0F1B33]" aria-label={t('queue.selectAll')} checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(items.map((m) => m.id)))} />
            <span>{t('queue.cols.case')}</span><span>{t('queue.cols.applicant')}</span><span>{t('queue.cols.status')}</span><span>{t('queue.cols.deadline')}</span>
            <span className="flex items-center gap-1">{t('queue.cols.next')}<HelpTip text={t('why.rule')} label={t('why.title')} /></span>
          </div>
          {state.loading && !state.data ? <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            : items.length === 0 ? <EmptyState icon={Inbox} title={nFilters || sp.get('q') ? t('queue.emptyTitle') : t('queue.emptyView')} text={nFilters || sp.get('q') ? t('queue.emptyText') : t('queue.emptyViewText')} action={(nFilters > 0 || sp.get('q')) && <Button size="sm" onClick={clear}>{t('common.clearFilters')}</Button>} />
            : <ul>
              {items.map((m, i) => (
                <motion.li key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: Math.min(i, 8) * 0.02 }} onClick={(e) => { if (!e.target.closest('input,button,a')) nav(`/applications/${m.id}`); }}
                  className={`relative grid cursor-pointer grid-cols-[28px_1fr] items-start gap-x-3 gap-y-1 border-b px-4 py-3 last:border-0 md:grid-cols-[28px_130px_minmax(0,1.2fr)_120px_130px_minmax(0,1.3fr)] md:items-center rule ${sel.has(m.id) ? 'bg-saffron-100/40' : 'hover:bg-ivory-100'} ${active === i ? 'ring-2 ring-inset ring-saffron-500' : ''}`}>
                  <span className={`absolute inset-y-0 left-0 w-1 ${MARK[m.status === 'pending' ? urgencyTone(m.daysLeft) : 'slate']}`} aria-hidden />
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#0F1B33] md:mt-0" aria-label={t('queue.select', { id: m.id })} checked={sel.has(m.id)} onChange={() => toggle(m.id)} />
                  <div><Link to={`/applications/${m.id}`} className="num font-mono text-[13px] font-medium hover:underline">{m.id}</Link><p className="text-xs text-ink-400">{t(`type.${m.type}`)}</p></div>
                  <div className="col-start-2 min-w-0 md:col-start-auto"><p className="truncate font-semibold">{f.L(m.name)}</p><p className="truncate text-[13px] text-ink-400">{f.L(m.village)} · {t('field.khasra')} {m.khasra} · {f.area(m.area)}</p></div>
                  <div className="col-start-2 flex flex-wrap items-center gap-1.5 md:col-start-auto"><StatusBadge status={m.status} />{m.queuedBy && <Tooltip_ text={t('queue.queued')} />}</div>
                  <div className="col-start-2 md:col-start-auto"><Deadline m={m} /></div>
                  <div className="col-start-2 min-w-0 md:col-start-auto">
                    {m.status === 'pending' || m.status === 'returned' ? <p className="text-[13.5px] leading-snug">{t(`next.${m.nextAction}`)}</p> : <p className="text-[13px] text-ink-400">—</p>}
                    <div className="mt-1 flex flex-wrap gap-1"><WhyChips why={m.why} max={2} />{m.returnsCount > 0 && m.why.every((w) => w.k !== 'repeat_return') && <Badge tone="slate">{t('queue.returnsBadge', { count: m.returnsCount })}</Badge>}</div>
                  </div>
                </motion.li>))}
            </ul>}
        </div>)}

      {state.data && state.data.pages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-600">
          <span aria-live="polite">{t('queue.results', { count: state.data.total })}{!all ? '' : ''}</span>
          {items.length > 0 && <span className="hidden text-xs text-ink-400 lg:inline">{t('queue.kbd')}</span>}
          <div className="flex items-center gap-2">
            <Button size="sm" icon={ChevronLeft} disabled={state.data.page <= 1} onClick={() => set({ page: String(state.data.page - 1) })} aria-label={t('common.previous')} />
            <span className="num">{t('common.page', { page: state.data.page, pages: state.data.pages })}</span>
            <Button size="sm" icon={ChevronRight} disabled={state.data.page >= state.data.pages} onClick={() => set({ page: String(state.data.page + 1) })} aria-label={t('common.next')} />
          </div>
        </div>)}

      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl rounded-xl bg-ink-900 p-3 text-ivory-50 shadow-pop lg:left-[17rem]" role="region" aria-label={t('queue.bulk.selected', { count: sel.size })}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 text-sm font-semibold"><span className="num">{t('queue.bulk.selected', { count: sel.size })}</span></span>
              <Popover label={t('queue.bulk.assign')} align="left" width="w-64" trigger={({ toggle, ...p }) => <Button size="sm" variant="dark" icon={UserPlus} onClick={toggle} {...p}>{t('queue.bulk.assign')}</Button>}>
                {(close) => <ul className="py-1 text-sm text-ink-900">{officers.map((o) => <li key={o.id}><button className="w-full px-4 py-2 text-left hover:bg-ivory-100" onClick={() => { close(); bulk('assign', o.id); }}>{f.L(o.name)} <span className="text-ink-400">· {o.pending}</span></button></li>)}<li><button className="w-full border-t rule px-4 py-2 text-left hover:bg-ivory-100" onClick={() => { close(); bulk('assign', 'none'); }}>{t('common.unassigned')}</button></li></ul>}
              </Popover>
              <Button size="sm" variant="dark" icon={ListPlus} onClick={() => bulk('queue')}>{t('queue.bulk.queue')}</Button>
              <Button size="sm" variant="dark" icon={ListMinus} onClick={() => bulk('unqueue')}>{t('queue.bulk.unqueue')}</Button>
              <Button size="sm" variant="dark" icon={Download} onClick={exportSel}>{t('queue.bulk.export')}</Button>
              <Button size="sm" variant="dark" icon={X} onClick={() => setSel(new Set())} className="ml-auto">{t('queue.bulk.clear')}</Button>
            </div>
            <p className="mt-1 flex items-center gap-1.5 px-2 text-[12px] text-ink-300"><ShieldAlert size={13} />{t('queue.bulk.note')}</p>
          </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
const Tooltip_ = ({ text }) => <Badge tone="saffron">{text}</Badge>;
