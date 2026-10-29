import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleDashed, FileWarning, ChevronDown, Link2, Loader2, RefreshCw, ScanSearch, StickyNote, Undo2, Ban, Lightbulb, Info, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth, useData, useToast } from '../state';
import { Badge, Button, ErrorState, HelpTip, Skeleton, StatusBadge, SEV_TONE, KIND_TONE } from '../components/ui';
import { WhyChips } from '../components/CaseBits';
import ReviewDrawer from '../components/ReviewDrawer';
import DecisionDialog from '../components/DecisionDialog';
import { STEPS, NEXT_STEP, useFindingText, useAuditText, useActor } from '../components/ReviewBits';
import { errText, useFmt, urgencyTone, resume } from '../lib/fmt';

const DOC_ICON = { provided: [CheckCircle2, 'text-moss-600'], missing: [CircleDashed, 'text-brick-600'], unclear: [FileWarning, 'text-warn-600'] };

function Running() {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => Math.min(x + 1, 3)), 330); return () => clearInterval(id); }, []);
  const steps = t('ai.steps');
  return (
    <div className="p-6" role="status" aria-live="polite">
      <p className="mb-4 flex items-center gap-2 font-semibold"><Loader2 size={18} className="animate-spin text-saffron-600" />{t('ai.running')}</p>
      <ol className="space-y-2.5">{steps.map((s, k) => <li key={s} className={`flex items-center gap-2.5 text-sm ${k > i ? 'text-ink-300' : ''}`}>{k < i ? <CheckCircle2 size={16} className="text-moss-600" /> : k === i ? <Loader2 size={16} className="animate-spin text-saffron-600" /> : <CircleDashed size={16} />}{s}</li>)}</ol>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ivory-200" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={i + 1}><motion.div className="h-full bg-saffron-500" initial={{ width: '8%' }} animate={{ width: `${((i + 1) / 4) * 100}%` }} transition={{ duration: 0.3 }} /></div>
    </div>
  );
}

const Section = ({ title, sub, children, right }) => <section className="px-5 py-5 sm:px-6"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-bold">{title}</h2>{sub && <p className="text-[13.5px] text-ink-600">{sub}</p>}</div>{right}</div>{children}</section>;
const Gate = ({ ai, run, children }) => (ai.state === 'idle' || ai.state === 'running' ? <Running /> : ai.state === 'error' ? <div className="p-6"><ErrorState error={ai.error} onRetry={run} /></div> : children);

/* ---------- 1. Understand ---------- */
function Understand({ app, ai, go, simulate, busy }) {
  const f = useFmt(); const { t } = f; const last = app.returns[app.returns.length - 1];
  const target = NEXT_STEP[app.nextAction];
  return (
    <Section title={t('review.steps.understand')}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[15px] sm:grid-cols-3">
        {[[t('review.identity.applicant'), f.L(app.applicant.name)], [app.applicant.rel === 'पति' ? t('review.identity.relation_husband') : t('review.identity.relation_father'), f.L(app.applicant.father)], [t('review.identity.village'), f.L(app.applicant.village)],
          [t('review.identity.khasra'), app.land.khasra], [t('review.identity.area'), f.area(app.land.claimedArea)], [t('review.identity.basis'), t(`type.${app.type}`)], [t('review.identity.submitted'), f.date(app.submittedAt)], [t('review.identity.mobile'), app.applicant.mobile]]
          .map(([k, v]) => <div key={k}><dt className="eyebrow">{k}</dt><dd className="num font-medium">{v}</dd></div>)}
      </dl>
      <div className="mt-5 rounded-lg border border-ivory-300 bg-white p-4"><p className="eyebrow mb-1">{t('ai.summary')}</p>
        {ai.state === 'done' ? <p className="text-[15px]">{t('ai.summaryText', { ...f.rp(ai.data.summaryParams), type: t(`type.${ai.data.summaryParams.type}`), area: ai.data.summaryParams.area })}</p> : <Skeleton className="h-12" />}</div>
      <div className="relative mt-4 rounded-lg border border-saffron-500/40 bg-saffron-100/50 p-4 pl-5">
        <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-saffron-500" aria-hidden />
        <p className="eyebrow">{t('review.nextTitle')}</p>
        <p className="mt-0.5 text-[16px] font-semibold">{t(`next.${app.nextAction}`)}</p><p className="text-[14px] text-ink-600">{t(`next.why.${app.nextAction}`)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><WhyChips why={app.why} max={4} /><HelpTip text={t('why.rule')} label={t('why.title')} /></div>
        {target && app.status === 'pending' && <Button size="sm" variant="primary" className="mt-3" onClick={() => go(target)}>{t('review.goTo')} <ArrowRight size={14} /></Button>}
      </div>
      {app.returns.length > 0 && (
        <div className="mt-5"><h3 className="mb-2 font-semibold">{t('review.returned.title')}</h3>
          {app.returns.length >= 2 && <p className="mb-2 rounded-lg bg-warn-100 px-3 py-2 text-sm text-warn-700">{t('review.returned.repeat', { count: app.returns.length })}</p>}
          <ul className="space-y-2">{[...app.returns].reverse().map((r) => (
            <li key={r.id} className="rounded-lg border border-ivory-300 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-ink-600">{t('review.returned.on', { date: f.date(r.at) })}{r.respondedAt && ` · ${t('review.returned.responded', { date: f.date(r.respondedAt) })}`}</span><Badge tone={r.status === 'awaiting' ? 'warn' : 'moss'} dot>{t(`review.returned.status_${r.status}`)}</Badge></div>
              {r.points.length > 0 && <><p className="eyebrow mt-2">{t('review.returned.reason')}</p><ul className="list-disc pl-5">{r.points.map((p, i) => <li key={i}>{t(`finding.${p.code}.title`, { docName: p.doc ? t(`doc.${p.doc}`) : '', a: '', b: '', count: '', days: '', other: '' })}</li>)}</ul></>}
              {r.note && <p className="mt-1 text-ink-600">“{r.note}”</p>}
            </li>))}</ul>
          {app.status === 'returned' && last?.status === 'awaiting' && (
            <div className="mt-3 rounded-lg border border-dashed border-ivory-400 p-3"><Button size="sm" onClick={simulate} loading={busy}>{t('review.returned.simulate')}</Button><p className="mt-2 text-xs text-ink-400">{t('review.returned.simulateHint')}</p></div>)}
        </div>)}
    </Section>
  );
}

/* ---------- 2. Documents ---------- */
function DocItem({ d, app, open, setOpen, flash, reload }) {
  const f = useFmt(); const { t } = f; const toast = useToast(); const actor = useActor();
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const [I, tone] = DOC_ICON[d.status];
  const hist = app.audit.filter((e) => e.action === 'doc_verified' && e.params?.doc === d.key);
  const verify = async (v) => { setBusy(true); try { await api.verify(app.id, d.key, { verified: v, note }); toast.success(t(v ? 'review.docs.verifiedToast' : 'review.docs.unverifiedToast')); setNote(''); await reload(); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); } };
  return (
    <li id={`doc-${d.key}`} className={`rounded-lg border bg-white transition-shadow ${flash === d.key ? 'border-saffron-500 ring-4 ring-saffron-500/20' : 'border-ivory-300'}`}>
      <button type="button" onClick={() => setOpen(open ? null : d.key)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <I size={20} className={tone} aria-hidden />
        <span className="min-w-0 flex-1"><span className="block font-medium">{t(`doc.${d.key}`)}{!d.required && <span className="ml-2 text-xs text-ink-400">{t('review.docs.extra')}</span>}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs"><span className={d.status === 'provided' ? 'text-ink-400' : tone}>{t(`docStatus.${d.status}`)}</span>{d.status !== 'missing' && d.key !== 'objection' && (d.verified ? <Badge tone="moss"><ShieldCheck size={12} />{t('docStatus.verified')}</Badge> : <Badge tone="slate">{t('docStatus.unverified')}</Badge>)}</span></span>
        <ChevronDown size={16} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="space-y-3 border-t rule px-4 pb-4 pt-3 text-sm">
              {d.status === 'missing' ? <p className="text-brick-700">{t('review.docs.none')}</p> : (<>
                <p className="text-xs text-ink-400">{t('review.docs.uploaded', { date: f.date(d.uploadedAt) })} · {t('review.docs.file', { name: d.file.name, kb: d.file.kb })}</p>
                <div><p className="eyebrow mb-1">{t('review.docs.fields')}</p><dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">{Object.entries(d.fields).map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-400">{t(`field.${k}`)}</dt><dd className="num font-medium">{f.fieldValue(k, v)}</dd></div>)}</dl></div>
                {d.verified && <p className="text-moss-700">{t('review.docs.verifiedBy', { name: f.L(app.audit.find((e) => e.action === 'doc_verified' && e.params?.doc === d.key && e.params?.verified)?.byName) || '', date: f.date(d.verified.at) })}{d.verified.note && ` — “${d.verified.note}”`}</p>}
                {app.status === 'pending' && d.key !== 'objection' && (<div className="rounded-lg bg-ivory-100 p-3">
                  {!d.verified && <input className="input mb-2" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t('review.docs.noteOptional')} aria-label={t('review.docs.note')} />}
                  <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant={d.verified ? 'outline' : 'primary'} icon={d.verified ? undefined : Check} loading={busy} onClick={() => verify(!d.verified)}>{d.verified ? t('review.docs.unverify') : t('review.docs.verify')}</Button>{!d.verified && <span className="text-xs text-ink-400">{t('review.docs.verifyNote')}</span>}</div></div>)}
                {hist.length > 0 && <div><p className="eyebrow mb-1">{t('review.docs.historyTitle')}</p><ul className="space-y-0.5 text-xs text-ink-600">{hist.map((e) => <li key={e.id}>{f.dateTime(e.at)} · {actor(e)} · {e.params.verified ? t('audit.verifiedOn') : t('audit.verifiedOff')}</li>)}</ul></div>}
              </>)}
            </div>
          </motion.div>)}
      </AnimatePresence>
    </li>
  );
}
function Documents({ app, reload, flash, openDoc, setOpenDoc }) {
  const { t } = useTranslation();
  return (
    <Section title={t('review.docs.title')} sub={t('review.docs.sub', { type: t(`type.${app.type}`) })}>
      <p className="mb-3 flex items-start gap-2 rounded-lg bg-ivory-100 px-3 py-2 text-[13px] text-ink-600"><Info size={15} className="mt-0.5 shrink-0" />{t('review.docs.disclaimer')}</p>
      <ul className="space-y-2">{app.docs.map((d) => <DocItem key={d.key} d={d} app={app} open={openDoc === d.key} setOpen={setOpenDoc} flash={flash} reload={reload} />)}</ul>
    </Section>
  );
}

/* ---------- 3. Issues ---------- */
function Finding({ x, app, onEvidence, onSaved, idx }) {
  const f = useFmt(); const { t } = f; const ft = useFindingText(); const toast = useToast(); const { officerName } = useData();
  const [open, setOpen] = useState(idx === 0 && x.open), [pick, setPick] = useState(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const editable = app.status === 'pending' && x.category === 'doc', needReason = pick === 'resolved' || pick === 'na';
  const bar = { high: 'bg-brick-600', medium: 'bg-warn-600', low: 'bg-ink-300' }[x.severity];
  const save = async (state) => { setBusy(true); try { await api.finding(app.id, { id: x.id, state, reason }); toast.success(t('review.issues.saved')); setPick(null); setReason(''); await onSaved(); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); } };
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + idx * 0.06, duration: 0.2 }} className={`relative overflow-hidden rounded-lg border border-ivory-300 bg-white ${x.open ? '' : 'opacity-75'}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 py-3 pl-5 pr-4 text-left">
        <span className="min-w-0 flex-1"><span className="mb-1 flex flex-wrap gap-1.5"><Badge tone={SEV_TONE[x.severity]}>{t(`sev.${x.severity}`)}</Badge><Badge tone={KIND_TONE[x.kind]}>{t(`kind.${x.kind}`)}</Badge>{x.category === 'process' && <Badge>{t('review.issues.process')}</Badge>}{x.state && <Badge tone={x.state.state === 'reviewed' ? 'saffron' : 'moss'} dot>{t(`fstate.${x.state.state}`)}</Badge>}</span><span className="block font-medium">{ft.title(x)}</span></span>
        <ChevronDown size={16} className={`mt-2 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="space-y-3 pb-4 pl-5 pr-4 text-sm">
              <p>{ft.explain(x)}</p>
              <p className="text-[13px] text-ink-600"><b>{t('ai.uncertainty')}:</b> {t(`ai.uncertain.${x.kind}`)}</p>
              <div><p className="eyebrow mb-1.5">{t('ai.evidence')}</p><div className="flex flex-wrap gap-1.5">{x.evidence.map((e, i) => (
                <button key={i} type="button" onClick={() => onEvidence(e.doc)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-ivory-300 bg-ivory-100 px-2 py-1 text-[12.5px] hover:border-saffron-500"><Link2 size={12} className="shrink-0 text-saffron-600" /><span className="truncate">{t(`doc.${e.doc}`)} · {t(`field.${e.field}`)}: <b className="num">{f.fieldValue(e.field, e.value, e.valueEn)}</b></span></button>))}</div></div>
              <p className="rounded-lg bg-ivory-100 px-3 py-2"><b>{t('ai.whatNext')}:</b> {ft.next(x)}</p>
              {x.state && <p className="text-xs text-ink-600">{t('review.issues.by', { state: t(`fstate.${x.state.state}`), name: f.L(officerName(x.state.by)), date: f.date(x.state.at) })}{x.state.reason && ` — “${x.state.reason}”`}</p>}
              {editable && (
                <div className="rounded-lg border border-ivory-300 p-3"><p className="eyebrow mb-2">{t('review.issues.mark')}</p>
                  <div className="flex flex-wrap gap-2">
                    {x.state?.state !== 'reviewed' && <Button size="sm" loading={busy && !needReason} onClick={() => save('reviewed')}>{t('review.issues.reviewed')}</Button>}
                    <Button size="sm" variant={pick === 'resolved' ? 'primary' : 'outline'} onClick={() => setPick('resolved')}>{t('review.issues.resolved')}</Button>
                    <Button size="sm" variant={pick === 'na' ? 'primary' : 'outline'} onClick={() => setPick('na')}>{t('review.issues.na')}</Button>
                    {x.state && <Button size="sm" variant="ghost" onClick={() => save('open')}>{t('review.issues.reopen')}</Button>}
                  </div>
                  {needReason && <div className="mt-2 space-y-2"><input className="input" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={t('review.issues.reason')} aria-label={t('review.issues.reason')} /><div className="flex items-center gap-3"><Button size="sm" variant="primary" loading={busy} disabled={reason.trim().length < 5} onClick={() => save(pick)}>{t('review.issues.save')}</Button><span className="text-xs text-ink-400">{t('review.issues.reasonRequired')}</span></div></div>}
                </div>)}
            </div>
          </motion.div>)}
      </AnimatePresence>
    </motion.li>
  );
}
function Issues({ app, ai, run, onEvidence, onSaved }) {
  const { t } = useTranslation();
  return (
    <Gate ai={ai} run={run}>
      {ai.state === 'done' && (() => { const list = ai.data.findings, open = list.filter((x) => x.category === 'doc' && x.open).length; return (
        <Section title={t('review.issues.title')} sub={t('review.issues.sub')} right={<Badge tone={open ? 'warn' : 'moss'}>{t('review.issues.openCount', { count: open })}</Badge>}>
          {list.length === 0 ? <p className="flex items-center gap-2 text-sm text-moss-700"><CheckCircle2 size={16} />{t('review.issues.none')}</p> : <ul className="space-y-2.5">{list.map((x, i) => <Finding key={x.id + (x.state?.at || '')} x={x} idx={i} app={app} onEvidence={onEvidence} onSaved={onSaved} />)}</ul>}
          <p className="mt-3 text-xs text-ink-400">{t('review.issues.showClosed')}</p>
        </Section>); })()}
    </Gate>
  );
}

/* ---------- 4. AI assistance ---------- */
function VerifyList({ items }) {
  const [done, setDone] = useState({});
  return <ul className="space-y-2">{items.map((it) => <li key={it.text}><label className="flex cursor-pointer items-start gap-2.5 text-sm"><input type="checkbox" checked={!!done[it.text]} onChange={() => setDone((s) => ({ ...s, [it.text]: !s[it.text] }))} className="mt-1.5 h-4 w-4 accent-[#0F1B33]" /><span className={done[it.text] ? 'text-ink-300 line-through' : ''}>{it.text}</span></label></li>)}</ul>;
}
function AI({ app, ai, run }) {
  const f = useFmt(); const { t } = f; const ft = useFindingText();
  const d = ai.data;
  return (
    <Gate ai={ai} run={run}>
      {d && (<>
        <div className="flex flex-wrap items-center gap-3 border-b rule bg-ink-900 px-5 py-4 text-ivory-50 sm:px-6"><ScanSearch size={20} className="text-saffron-400" /><div className="flex-1"><h2 className="font-serif text-lg font-bold leading-tight">{t('ai.title')}</h2><p className="text-[12.5px] text-ink-300">{t('ai.sub')}</p></div><Badge tone="saffron">{t('ai.badge')}</Badge>
          <Button size="sm" variant="dark" icon={RefreshCw} onClick={run}>{t('ai.rerun')}</Button></div>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <p className="flex items-start gap-2 rounded-lg bg-ivory-100 px-3 py-2 text-[13px] text-ink-600"><Info size={15} className="mt-0.5 shrink-0" />{t('ai.demoNote')}</p>
          <div><h3 className="mb-1 font-semibold">{t('ai.summary')}</h3><p className="text-[15px]">{t('ai.summaryText', { ...f.rp(d.summaryParams), type: t(`type.${d.summaryParams.type}`) })}</p></div>
          {d.confirmed.length > 0 && <div><h3 className="mb-1.5 font-semibold">{t('ai.confirmedTitle')}</h3><ul className="space-y-1.5">{d.confirmed.map((c) => <li key={c.code} className="flex gap-2 text-sm"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-moss-600" />{t(`confirmed.${c.code}`, f.rp(c.params))}</li>)}</ul></div>}
          <div className="rounded-lg border border-saffron-500/40 bg-saffron-100/50 p-4">
            <p className="flex items-center gap-2 font-semibold"><Lightbulb size={17} className="text-saffron-600" />{t('ai.suggestionIs', { decision: t(`ai.decision.${d.recommendation.decision}`) })}</p>
            <p className="eyebrow mt-3">{t('ai.because')}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{d.recommendation.reasons.map((r, i) => <li key={i}>{ft.reason(r, d.findings)}</li>)}</ul>
            <p className="mt-3 text-xs text-ink-600">{t('ai.officerFinal')}</p>
          </div>
          <div><h3 className="mb-1.5 font-semibold">{t('ai.verifyTitle')}</h3><VerifyList items={d.verify.map((v) => ({ text: v.k === 'std' ? t(`std.${v.key}`) : ft.next(ft.byId(d.findings, v.ref)) }))} /></div>
          <div><h3 className="mb-1.5 font-semibold">{t('ai.limitsTitle')}</h3><ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink-600">{t('ai.limits').map((l) => <li key={l}>{l}</li>)}</ul></div>
        </div></>)}
    </Gate>
  );
}

/* ---------- 5. Decide ---------- */
function Decide({ app, ai, setMode, user, assignee }) {
  const f = useFmt(); const { t } = f;
  const d = ai.state === 'done' ? ai.data : null;
  const openHigh = d ? d.findings.filter((x) => x.category === 'doc' && x.open && x.severity === 'high').length : null, unver = app.unverified;
  const opts = [['approved', 'approve', Check, 'primary'], ['returned', 'return', Undo2, 'warn'], ['rejected', 'reject', Ban, 'danger']];
  return (
    <Section title={t('review.decide.title')} sub={t('review.decide.sub')}>
      <div className="rounded-lg border border-ivory-300 bg-white p-4"><p className="eyebrow mb-2">{t('review.decide.readiness')}</p>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">{openHigh === null ? <Loader2 size={15} className="animate-spin" /> : openHigh ? <FileWarning size={15} className="text-brick-600" /> : <CheckCircle2 size={15} className="text-moss-600" />}{openHigh === null ? t('common.loading') : openHigh ? t('review.decide.openHigh', { count: openHigh }) : t('review.decide.allClear')}</li>
          <li className="flex items-center gap-2">{unver ? <FileWarning size={15} className="text-warn-600" /> : <CheckCircle2 size={15} className="text-moss-600" />}{unver ? t('review.decide.unverifiedDocs', { count: unver }) : t('review.decide.docsOk')}</li>
          {d && <li className="flex items-center gap-2"><Lightbulb size={15} className="text-saffron-600" />{t('review.decide.aiSays', { decision: t(`ai.decision.${d.recommendation.decision}`) })}</li>}
        </ul></div>
      {app.status !== 'pending' ? <p className="mt-4 rounded-lg bg-ivory-200 px-4 py-3 text-sm font-medium"><StatusBadge status={app.status} /> <span className="ml-2">{t('review.decide.decided')}</span></p>
        : !app.canDecide ? <p className="mt-4 rounded-lg bg-warn-100 px-4 py-3 text-sm text-warn-700">{t('review.decide.noPerm', { name: f.L(assignee) })}</p>
        : <div className="mt-4 grid gap-3 sm:grid-cols-3">{opts.map(([m, k, I, v]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`group rounded-lg border bg-ivory-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift ${{ primary: 'border-ink-900/25 hover:border-ink-900', warn: 'border-warn-600/35 hover:border-warn-600', danger: 'border-brick-600/30 hover:border-brick-600' }[v]}`}>
            <I size={18} className={{ primary: 'text-ink-900', warn: 'text-warn-700', danger: 'text-brick-700' }[v]} /><p className="mt-2 font-semibold">{t(`review.decide.${k}`)}</p><p className="text-[12.5px] text-ink-400">{t(`review.decide.${k}Hint`)}</p></button>))}</div>}
    </Section>
  );
}

/* ---------- page ---------- */
export default function Review() {
  const { id } = useParams(); const [sp, setSp] = useSearchParams();
  const f = useFmt(); const { t } = f; const toast = useToast(); const { refreshBadges, officerName } = useData();
  const [app, setApp] = useState(null), [err, setErr] = useState(null), [ai, setAi] = useState({ state: 'idle' });
  const [drawer, setDrawer] = useState(false), [mode, setMode] = useState(null), [flash, setFlash] = useState(null), [openDoc, setOpenDoc] = useState(null), [doneMsg, setDoneMsg] = useState(null), [busy, setBusy] = useState(false);
  const step = STEPS.includes(sp.get('step')) ? sp.get('step') : 'understand', idx = STEPS.indexOf(step);
  const go = useCallback((s) => { const n = new URLSearchParams(sp); n.set('step', s); setSp(n, { replace: true }); window.scrollTo({ top: 0 }); }, [sp, setSp]);

  const load = useCallback(() => api.get(id).then(setApp).catch(setErr), [id]);
  const analyze = useCallback((o = {}) => { if (o.animate) setAi((s) => ({ ...s, state: 'running' })); return api.analyze(id, o).then((data) => setAi({ state: 'done', data })).catch((error) => setAi({ state: 'error', error })); }, [id]);
  useEffect(() => { setApp(null); setErr(null); setAi({ state: 'idle' }); load(); analyze({ animate: true }); }, [id]); // eslint-disable-line
  useEffect(() => { if (app) resume.set({ id: app.id, name: app.applicant.name, step }); }, [app?.id, step]); // eslint-disable-line
  const refresh = useCallback(async () => { await load(); analyze(); refreshBadges(); }, [load, analyze, refreshBadges]);

  const focusDoc = (key) => { if (key === 'application') return go('understand'); go('documents'); setOpenDoc(key); setFlash(key); setTimeout(() => document.getElementById(`doc-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 320); setTimeout(() => setFlash(null), 2400); };
  const onDone = (updated, m) => { setApp(updated); setMode(null); setDoneMsg(m); toast.success(t(`decision.done.${m}`), t('decision.doneText')); refreshBadges(); analyze(); go('decide'); };
  const simulate = async () => { setBusy(true); try { setApp(await api.simulate(id)); toast.success(t('review.returned.simulated')); analyze(); refreshBadges(); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); } };

  if (err) return <ErrorState error={err} onRetry={() => { setErr(null); load(); }} />;
  if (!app) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-12" /><Skeleton className="h-96" /></div>;
  const pending = app.status === 'pending', openTasks = app.tasks.filter((x) => !x.done).length;
  const docBadge = app.docProblems, issueBadge = ai.state === 'done' ? ai.data.findings.filter((x) => x.category === 'doc' && x.open).length : null;
  const badgeFor = { documents: docBadge, issues: issueBadge };

  return (
    <div>
      <Link to="/applications" className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"><ArrowLeft size={15} />{t('review.back')}</Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="num font-mono text-sm text-ink-400">{app.id}</p><h1 className="font-serif text-[1.9rem] font-bold">{f.L(app.applicant.name)}</h1>
          <p className="text-ink-600">{f.L(app.applicant.village)} · {t('field.khasra')} {app.land.khasra} · <span className="num">{f.area(app.land.claimedArea)}</span> · {t(`type.${app.type}`)}</p>
          <p className="mt-0.5 text-[13px] text-ink-400">{app.assigneeName ? t('review.assignedTo', { name: f.L(app.assigneeName) }) : t('review.notAssigned')}</p></div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2"><AnimatePresence mode="wait"><motion.div key={app.status} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}><StatusBadge status={app.status} /></motion.div></AnimatePresence>
            {pending && <Badge tone={urgencyTone(app.daysLeft)}>{f.deadline(app.daysLeft)}</Badge>}</div>
          {pending && <p className="text-xs text-ink-400">{t('review.slaLine', { days: app.slaDays })}</p>}
          <div className="flex gap-2"><Button size="sm" icon={StickyNote} onClick={() => setDrawer(true)}>{t('review.tools')}{(app.notes.length + openTasks > 0) && <span className="num ml-1 rounded-full bg-ink-900 px-1.5 text-[11px] text-ivory-50">{app.notes.length + openTasks}</span>}</Button>
            {pending && app.canDecide && <Button size="sm" variant="primary" onClick={() => go('decide')}>{t('review.decideNow')}</Button>}</div>
        </div>
      </header>

      <AnimatePresence>{doneMsg && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div role="status" className="mt-4 flex items-center gap-3 rounded-lg border border-moss-600/30 bg-moss-100 px-4 py-3 text-moss-700"><CheckCircle2 size={20} /><p className="flex-1 text-sm font-medium">{t(`decision.done.${doneMsg}`)}. {t('decision.doneBanner')}</p><button onClick={() => setDoneMsg(null)} className="text-sm underline underline-offset-4">{t('common.done')}</button></div></motion.div>}</AnimatePresence>

      <nav className="mt-5 flex overflow-x-auto rounded-lg border border-ivory-300 bg-ivory-50" aria-label={t('review.step', { n: idx + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <button key={s} type="button" aria-current={step === s ? 'step' : undefined} onClick={() => go(s)} className={`relative flex min-w-fit flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${step === s ? 'text-ink-900' : 'text-ink-400 hover:text-ink-900'}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${step === s ? 'bg-ink-900 text-ivory-50' : 'bg-ivory-300 text-ink-600'}`}>{i + 1}</span>{t(`review.steps.${s}`)}
            {badgeFor[s] > 0 && <span className="num rounded-full bg-saffron-500 px-1.5 text-[11px] font-semibold text-ink-950">{badgeFor[s]}</span>}
            {step === s && <motion.span layoutId="step-ul" className="absolute inset-x-0 bottom-0 h-[2px] bg-saffron-500" transition={{ duration: 0.2 }} />}
          </button>))}
      </nav>

      <div className="panel mt-4 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            {step === 'understand' && <Understand app={app} ai={ai} go={go} simulate={simulate} busy={busy} />}
            {step === 'documents' && <Documents app={app} reload={refresh} flash={flash} openDoc={openDoc} setOpenDoc={setOpenDoc} />}
            {step === 'issues' && <Issues app={app} ai={ai} run={() => analyze({ animate: true })} onEvidence={focusDoc} onSaved={refresh} />}
            {step === 'ai' && <AI app={app} ai={ai} run={() => analyze({ animate: true, log: true })} />}
            {step === 'decide' && <Decide app={app} ai={ai} setMode={setMode} assignee={app.assigneeName} />}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center justify-between border-t rule bg-ivory-100 px-5 py-3">
          <Button size="sm" icon={ArrowLeft} disabled={idx === 0} onClick={() => go(STEPS[idx - 1])}>{t('review.prev')}</Button>
          <span className="num text-xs text-ink-400">{t('review.step', { n: idx + 1, total: STEPS.length })}</span>
          <Button size="sm" variant="primary" disabled={idx === STEPS.length - 1} onClick={() => go(STEPS[idx + 1])}>{idx === STEPS.length - 2 ? t('review.toDecision') : t('review.nextStep')} <ArrowRight size={14} /></Button>
        </div>
      </div>

      <ReviewDrawer open={drawer} onClose={() => setDrawer(false)} app={app} reload={refresh} />
      {mode && <DecisionDialog mode={mode} onClose={() => setMode(null)} analysis={ai.state === 'done' ? ai.data : null} app={app} onDone={onDone} />}
    </div>
  );
}
