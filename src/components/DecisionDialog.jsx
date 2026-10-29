import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../state';
import { Button, Dialog } from './ui';
import { errText, useFmt } from '../lib/fmt';
import { useFindingText } from './ReviewBits';

const SUG = { approve: 'approved', return: 'returned', reject: 'rejected' };
const KEY = { approved: 'approve', returned: 'return', rejected: 'reject' };
const VARIANT = { approved: 'primary', returned: 'warn', rejected: 'danger' };

export default function DecisionDialog({ mode, onClose, analysis, app, onDone }) {
  const f = useFmt(); const { t } = f; const { user } = useAuth(); const ft = useFindingText();
  const [note, setNote] = useState(''), [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [picked, setPicked] = useState(null), [letter, setLetter] = useState(''), [dirty, setDirty] = useState(false), [copied, setCopied] = useState(false);
  const refs = analysis?.returnPoints || [];
  // Until the officer changes it, the selection is simply the suggested points (so it is correct as soon as the analysis arrives).
  const sel = picked ?? refs.map((r) => r.id);
  useEffect(() => { setNote(''); setAck(false); setErr(''); setDirty(false); setPicked(null); }, [mode]);
  const chosen = useMemo(() => refs.filter((r) => sel.includes(r.id)), [refs, picked]);
  const draft = useMemo(() => {
    const pts = chosen.map((r, i) => `${i + 1}. ${ft.ask(analysis.findings.find((x) => x.id === r.id))}`).filter((l) => !/\d\.\s*$/.test(l)).join('\n');
    return `${t('letter.subject', { id: app.id })}\n\n${t('letter.body', { name: f.L(app.applicant.name), id: app.id, khasra: app.land.khasra, village: f.L(app.applicant.village), days: t('letter.days'), points: pts, remarks: note.trim() ? `${note.trim()}\n\n` : '', officer: f.L(user.name), designation: f.L(user.designation), office: f.L(user.office) })}`;
  }, [chosen, note, f.lang]); // eslint-disable-line
  useEffect(() => { if (!dirty) setLetter(draft); }, [draft, dirty]);
  if (!mode) return <Dialog open={false} onClose={onClose} title="" />;
  const k = KEY[mode], sug = analysis?.recommendation.decision;
  const differs = sug && SUG[sug] !== mode;
  const openHigh = analysis?.findings.filter((x) => x.category === 'doc' && x.open && x.severity === 'high').length || 0;
  const valid = ack && (mode === 'approved' || (mode === 'rejected' ? note.trim().length >= 10 : note.trim().length >= 10 || sel.length > 0));
  const go = async () => {
    setBusy(true); setErr('');
    try { onDone(await api.decide(app.id, { decision: mode, note, points: mode === 'returned' ? chosen.map(({ code, doc }) => ({ code, ...(doc ? { doc } : {}) })) : [], ack }), mode); }
    catch (e) { setErr(errText(t, e)); setBusy(false); }
  };
  return (
    <Dialog open onClose={busy ? () => {} : onClose} title={t(`decision.${k}.title`)} subtitle={`${f.L(app.applicant.name)} · ${app.id}`} width="max-w-xl"
      footer={<><Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button><Button variant={VARIANT[mode]} onClick={go} disabled={!valid} loading={busy}>{t(`decision.${k}.cta`)}</Button></>}>
      <div className="space-y-4 text-sm">
        {differs && <p className="rounded-lg bg-saffron-100 px-3 py-2 text-saffron-700">{t('decision.differs', { decision: t(`ai.decision.${sug}`) })}</p>}
        {mode === 'approved' && openHigh > 0 && <p className="rounded-lg bg-brick-100 px-3 py-2 text-brick-700">{t('decision.openHigh', { count: openHigh })}</p>}
        {mode === 'returned' && refs.length > 0 && (
          <fieldset><legend className="mb-2 font-semibold">{t('decision.points')}</legend>
            <div className="space-y-2">{refs.map((r) => { const x = analysis.findings.find((y) => y.id === r.id); return <label key={r.id} className="flex cursor-pointer items-start gap-2.5"><input type="checkbox" className="mt-1.5 h-4 w-4 accent-[#0F1B33]" checked={sel.includes(r.id)} onChange={() => setPicked(sel.includes(r.id) ? sel.filter((v) => v !== r.id) : [...sel, r.id])} />{ft.title(x)}</label>; })}</div></fieldset>)}
        <div>
          <label htmlFor="note" className="font-semibold">{mode === 'approved' ? t('decision.noteOptional') : mode === 'rejected' ? t('decision.noteReason') : t('decision.noteAdd')}</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="text-xs text-ink-400">{t('decision.templates')}:</span><button type="button" className="rounded-full border border-ivory-300 bg-ivory-100 px-2.5 py-0.5 text-xs hover:border-saffron-500" onClick={() => setNote(t(`decision.tpl.${k}`))}>{t(`decision.tpl.${k}`)}</button></div>
          <textarea id="note" rows={3} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={t('decision.notePlaceholder')} className="input mt-2" />
          {mode !== 'approved' && <p className="mt-1 text-xs text-ink-400">{t('decision.minChars')}</p>}
        </div>
        {mode === 'returned' && (
          <details className="rounded-lg border border-ivory-300 bg-white">
            <summary className="cursor-pointer px-3 py-2 font-medium">{t('decision.letter')}</summary>
            <div className="space-y-2 border-t rule p-3"><p className="text-xs text-ink-400">{t('decision.letterHint')}</p>
              <textarea rows={9} value={letter} onChange={(e) => { setLetter(e.target.value); setDirty(true); }} className="input font-mono text-[13px]" aria-label={t('decision.letter')} />
              <Button size="sm" icon={Copy} onClick={async () => { try { await navigator.clipboard.writeText(letter); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}>{copied ? t('common.copied') : t('decision.letterCopy')}</Button></div>
          </details>)}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-ivory-100 px-3 py-2.5"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1.5 h-4 w-4 accent-[#0F1B33]" />{t('decision.ack')}</label>
        {err && <p role="alert" className="text-brick-700">{err}</p>}
      </div>
    </Dialog>
  );
}
