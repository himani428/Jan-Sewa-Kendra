import { useData } from '../state';
import { useFmt } from '../lib/fmt';

export const STEPS = ['understand', 'documents', 'issues', 'ai', 'decide'];
export const NEXT_STEP = { request_docs: 'documents', request_clear: 'documents', verify_docs: 'documents', compare_records: 'issues', inspect_fields: 'issues', field_inquiry: 'issues', verify_points: 'issues', legal_check: 'issues', ready_decide: 'decide' };

// Translating analysis output (codes + params) into the display language.
export function useFindingText() {
  const f = useFmt(); const { t } = f;
  const g = (x, part) => t(`finding.${x.code}.${part}`, f.fp(x));
  const byId = (list, id) => list?.find((x) => x.id === id);
  const reason = (r, findings) => {
    if (r.k === 'restriction' || r.k === 'blocking') { const x = byId(findings, r.ref); return t(`reason.${r.k}`, { title: x ? g(x, 'title') : '' }); }
    if (r.k === 'confirmed') return t(`confirmed.${r.code}`, f.rp(r.params));
    return t(`reason.${r.k}`);
  };
  return { title: (x) => g(x, 'title'), explain: (x) => g(x, 'explain'), next: (x) => g(x, 'next'), ask: (x) => g(x, 'ask'), reason, byId };
}

// Audit entry -> one readable sentence in the current language.
export function useAuditText() {
  const f = useFmt(); const { t } = f; const { officerName } = useData();
  const who = (id) => (id ? f.L(officerName(id)) || id : t('common.unassigned'));
  return (e) => {
    const p = e.params || {};
    switch (e.action) {
      case 'assigned': return t('audit.assigned', { from: who(e.from), to: who(e.to) });
      case 'finding_marked': { const [code, doc] = String(p.finding || '').split(':'); return t('audit.finding_marked', { finding: t(`finding.${code}.title`, { docName: doc ? t(`doc.${doc}`) : '', a: '', b: '', count: '', days: '', other: '' }), state: t(`fstate.${e.to}`) }); }
      case 'doc_verified': return t('audit.doc_verified', { doc: t(`doc.${p.doc}`), state: p.verified ? t('audit.verifiedOn') : t('audit.verifiedOff') });
      case 'ai_review': return t('audit.ai_review', { findings: p.findings, suggestion: t(`ai.decision.${p.suggestion}`) });
      case 'resubmitted': return t('audit.resubmitted', { sim: p.simulated ? t('audit.simulated') : '' });
      default: return t(`audit.${e.action}`, { defaultValue: e.action });
    }
  };
}
export function useActor() {
  const f = useFmt(); const { t } = f;
  return (e) => (e.byName ? f.L(e.byName) : t(`audit.actor.${e.by}`, { defaultValue: e.by }));
}
export const reasonOf = (e, t) => e.reason || (e.reasonKey ? t(`seed.${e.reasonKey}`) : null);
