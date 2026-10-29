import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useToast } from '../state';
import { Badge, Button } from './ui';
import { errText, useFmt } from '../lib/fmt';
import { useAuditText, useActor, reasonOf } from './ReviewBits';

// Secondary case tools (notes, tasks, history) live in a slide-over so the main flow stays uncluttered.
export default function ReviewDrawer({ open, onClose, app, reload, initialTab = 'notes' }) {
  const f = useFmt(); const { t } = f; const toast = useToast(); const auditText = useAuditText(), actor = useActor();
  const [tab, setTab] = useState(initialTab), [note, setNote] = useState(''), [title, setTitle] = useState(''), [due, setDue] = useState(''), [q, setQ] = useState(''), [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const act = async (fn, msg, after) => { setBusy(true); try { await fn(); toast.success(msg); after?.(); await reload(); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); } };
  const hist = app.audit.filter((e) => !q.trim() || `${auditText(e)} ${reasonOf(e, t) || ''} ${actor(e)}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <AnimatePresence>
      {open && (<>
        <motion.div className="fixed inset-0 z-40 bg-ink-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.aside role="dialog" aria-modal="false" aria-label={t('review.tools')} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-ivory-50 shadow-pop" initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
          <div className="flex items-center justify-between border-b rule px-5 py-3"><h2 className="font-serif text-lg font-bold">{t('review.tools')}</h2><button onClick={onClose} aria-label={t('review.closeTools')} className="rounded-md p-1.5 text-ink-400 hover:bg-ivory-200"><X size={18} /></button></div>
          <div role="tablist" className="flex border-b rule px-3">{['notes', 'tasks', 'history'].map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative px-3 py-2.5 text-sm font-medium ${tab === k ? 'text-ink-900' : 'text-ink-400 hover:text-ink-900'}`}>{t(`review.${k}`)}{tab === k && <motion.span layoutId="drawer-tab" className="absolute inset-x-0 -bottom-px h-[2px] bg-saffron-500" />}</button>)}</div>
          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'notes' && (<div className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); if (note.trim().length >= 2) act(() => api.note(app.id, note), t('drawer.noteAdded'), () => setNote('')); }}>
                <textarea className="input" rows={3} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={t('drawer.notePlaceholder')} aria-label={t('drawer.notes')} />
                <Button type="submit" size="sm" variant="primary" className="mt-2" icon={Plus} loading={busy} disabled={note.trim().length < 2}>{t('drawer.addNote')}</Button></form>
              {app.notes.length === 0 ? <p className="text-sm text-ink-400">{t('drawer.notesEmpty')}</p> : <ul className="space-y-3">{app.notes.map((n) => <li key={n.id} className="rounded-lg border border-ivory-300 bg-white p-3 text-sm"><p className="whitespace-pre-wrap">{f.L(n.text)}</p><p className="mt-1 text-xs text-ink-400">{f.L(n.byName)} · {f.dateTime(n.at)}</p></li>)}</ul>}
            </div>)}
            {tab === 'tasks' && (<div className="space-y-4">
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act(() => api.task(app.id, { title, dueDate: due }), t('drawer.taskAdded'), () => { setTitle(''); setDue(''); }); }}>
                <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={t('drawer.taskTitle')} aria-label={t('drawer.taskTitle')} />
                <div className="flex gap-2"><input type="date" className="input" min={today} value={due} onChange={(e) => setDue(e.target.value)} aria-label={t('drawer.taskDue')} /><Button type="submit" size="sm" variant="primary" icon={Plus} loading={busy} disabled={title.trim().length < 3 || !due}>{t('drawer.addTask')}</Button></div></form>
              {app.tasks.length === 0 ? <p className="text-sm text-ink-400">{t('drawer.tasksEmpty')}</p> : <ul className="space-y-2">{app.tasks.map((k) => { const late = !k.done && k.dueAt < new Date().setHours(0, 0, 0, 0); return (
                <li key={k.id} className="flex items-start gap-3 rounded-lg border border-ivory-300 bg-white p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#0F1B33]" checked={k.done} aria-label={f.L(k.title)} onChange={() => act(() => api.taskDone(k.id, !k.done), t(k.done ? 'tasks.reopenedToast' : 'tasks.completedToast'))} />
                  <div><p className={k.done ? 'text-ink-400 line-through' : ''}>{f.L(k.title)}</p><p className="text-xs text-ink-400">{t('drawer.due', { date: f.date(k.dueAt) })} {late && <Badge tone="brick">{t('drawer.overdue')}</Badge>}</p></div></li>); })}</ul>}
            </div>)}
            {tab === 'history' && (<div className="space-y-3">
              <label className="flex items-center gap-2 rounded-lg border border-ivory-300 bg-white px-3 py-1.5 text-sm"><Search size={14} className="text-ink-400" /><input className="w-full bg-transparent outline-none" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('drawer.historySearch')} aria-label={t('drawer.historySearch')} /></label>
              {hist.length === 0 ? <p className="text-sm text-ink-400">{t('drawer.historyEmpty')}</p> : <ol className="ml-2 space-y-4 border-l rule pl-5">{hist.map((e) => <li key={e.id} className="relative"><span className={`absolute -left-[26px] top-2 h-2.5 w-2.5 rounded-full ring-4 ring-ivory-50 ${{ approved: 'bg-moss-600', rejected: 'bg-brick-600', returned: 'bg-warn-600' }[e.action] || 'bg-ink-300'}`} />
                <p className="text-sm">{auditText(e)}</p>{reasonOf(e, t) && <p className="text-[13px] text-ink-600">“{reasonOf(e, t)}”</p>}<p className="num text-xs text-ink-400">{actor(e)} · {f.dateTime(e.at)}</p></li>)}</ol>}
              <p className="text-xs text-ink-400">{t('drawer.immutable')}</p>
            </div>)}
          </div>
        </motion.aside>
      </>)}
    </AnimatePresence>
  );
}
