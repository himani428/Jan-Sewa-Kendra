// Demo rule-based review engine. Output is language-neutral: codes + params. The client translates.
import { DAY, SLA_DAYS, REQUIRED, today0, startOfDay } from './util.js';
import { L, T } from './translit.js';

export const ageDays = (a) => Math.round((today0() - startOfDay(a.submittedAt)) / DAY);
export const daysLeft = (a) => (a.status === 'pending' ? SLA_DAYS - ageDays(a) : null);
const ev = (doc, field, value) => ({ doc, field, value, ...(typeof value === 'string' && T[value] ? { valueEn: T[value] } : {}) });

function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
function compareNames(items) {
  const vals = items.filter((i) => i.value);
  if (vals.length < 2) return { state: 'na' };
  const base = vals[0].value.trim(), diff = vals.filter((i) => i.value.trim() !== base);
  if (!diff.length) return { state: 'same', vals };
  let level = 'low';
  const sub = (x, y) => x.every((t) => y.includes(t));
  for (const d of diff) {
    const a = base.split(/\s+/), b = d.value.trim().split(/\s+/);
    if (lev(base, d.value.trim()) <= 2) continue;
    level = sub(a, b) || sub(b, a) ? (level === 'high' ? 'high' : 'medium') : 'high';
  }
  return { state: 'diff', level, vals };
}

export function analyze(app, all = []) {
  const docs = app.docs, req = REQUIRED[app.type], f = [], confirmed = [];
  const has = (k) => docs[k] && docs[k].status !== 'missing';
  const add = (code, o) => f.push({ id: o.doc ? `${code}:${o.doc}` : code, code, category: 'doc', params: {}, ...o });

  for (const k of req) {
    const d = docs[k];
    if (!d || d.status === 'missing') add('doc_missing', { doc: k, severity: 'high', kind: 'confirmed', evidence: [ev(k, 'status', 'missing')] });
    else if (d.status === 'unclear') add('doc_unclear', { doc: k, severity: 'medium', kind: 'confirmed', evidence: [ev(k, 'status', 'unclear')] });
  }
  const areaSrc = [{ doc: 'application', v: app.land.claimedArea }];
  if (app.type === 'sale' && has('deed')) areaSrc.push({ doc: 'deed', v: docs.deed.fields.area });
  if (has('khatauni')) areaSrc.push({ doc: 'khatauni', v: docs.khatauni.fields.area });
  if (areaSrc.length > 1) {
    if (areaSrc.every((s) => s.v === areaSrc[0].v)) confirmed.push({ code: 'area_same', params: { area: areaSrc[0].v }, docs: areaSrc.map((s) => s.doc) });
    else add('area_mismatch', { severity: 'high', kind: 'confirmed', evidence: areaSrc.map((s) => ev(s.doc, 'area', s.v)) });
  }
  const nameItems = [{ doc: 'application', value: app.applicant.name }];
  if (has('aadhaar')) nameItems.push({ doc: 'aadhaar', value: docs.aadhaar.fields.name });
  if (app.type === 'sale' && has('deed')) nameItems.push({ doc: 'deed', value: docs.deed.fields.name });
  const nc = compareNames(nameItems);
  if (nc.state === 'same') confirmed.push({ code: 'name_same', params: { name: L(nc.vals[0].value) }, docs: nc.vals.map((v) => v.doc) });
  else if (nc.state === 'diff') add(nc.level === 'low' ? 'name_variant' : nc.level === 'medium' ? 'name_extended' : 'name_mismatch', { severity: nc.level, kind: nc.level === 'high' ? 'confirmed' : 'potential', evidence: nc.vals.map((v) => ev(v.doc, 'name', v.value)) });

  if (app.type === 'inheritance') {
    const dn = compareNames(['death_cert', 'family_register', 'khatauni'].filter(has).map((k) => ({ doc: k, value: docs[k].fields.name })));
    if (dn.state === 'same') confirmed.push({ code: 'deceased_same', params: { name: L(dn.vals[0].value) }, docs: dn.vals.map((v) => v.doc) });
    else if (dn.state === 'diff') add('deceased_mismatch', { severity: 'high', kind: 'confirmed', evidence: dn.vals.map((v) => ev(v.doc, 'name', v.value)) });
    if (has('affidavit') && has('family_register')) {
      const h1 = docs.affidavit.fields.heirs, h2 = docs.family_register.fields.heirs;
      if (h1 === h2) confirmed.push({ code: 'heirs_same', params: { heirs: h1 }, docs: ['affidavit', 'family_register'] });
      else add('heirs_mismatch', { severity: 'high', kind: 'confirmed', params: { a: h1, b: h2 }, evidence: [ev('affidavit', 'heirs', h1), ev('family_register', 'heirs', h2)] });
    }
  }
  if (has('khatauni') && app.type === 'sale') {
    const t = docs.khatauni.fields.tenure;
    if (t === 'asami') add('tenure_restricted', { doc: 'khatauni', severity: 'high', kind: 'confirmed', restriction: true, evidence: [ev('khatauni', 'tenure', t)] });
    else confirmed.push({ code: 'tenure_ok', params: {}, docs: ['khatauni'] });
  }
  if (docs.objection) add('objection_unverified', { doc: 'objection', severity: 'medium', kind: 'unverified', evidence: [ev('objection', 'topic', docs.objection.fields.topic)] });
  for (const o of all) if (o.id !== app.id && o.land.khasra === app.land.khasra && o.applicant.village === app.applicant.village)
    add('duplicate_application', { severity: 'high', kind: 'potential', params: { other: o.id }, evidence: [ev('application', 'ref', o.id)] });
  if (app.returns?.length >= 2) f.push({ id: 'repeat_return', code: 'repeat_return', category: 'process', severity: 'medium', kind: 'confirmed', params: { count: app.returns.length }, evidence: [ev('application', 'returns', app.returns.length)] });
  const left = daysLeft(app);
  if (left !== null && left <= 7) f.push({ id: left < 0 ? 'deadline_overdue' : 'deadline_due', code: left < 0 ? 'deadline_overdue' : 'deadline_due', category: 'process', severity: left < 0 ? 'high' : 'medium', kind: 'confirmed', params: { days: Math.abs(left) }, evidence: [ev('application', 'age', ageDays(app))] });

  const order = { high: 0, medium: 1, low: 2 };
  f.sort((a, b) => order[a.severity] - order[b.severity]);
  for (const x of f) { const st = app.findingStates?.[x.id] || null; x.state = st; x.open = !st || st.state === 'reviewed'; }
  const docIssues = f.filter((x) => x.category === 'doc'), openDoc = docIssues.filter((x) => x.open);

  const restr = openDoc.find((x) => x.restriction);
  const blocking = openDoc.filter((x) => x.severity === 'high' || x.kind === 'unverified' || (x.severity === 'medium' && x.kind === 'confirmed'));
  let decision, reasons = [];
  if (restr) { decision = 'reject'; reasons = [{ k: 'restriction', ref: restr.id }, { k: 'not_fixable' }]; }
  else if (blocking.length) { decision = 'return'; reasons = [...blocking.map((x) => ({ k: 'blocking', ref: x.id })), { k: 'resolve_first' }]; }
  else {
    decision = 'approve';
    reasons = [{ k: 'all_docs' }, ...confirmed.slice(0, 3).map((c) => ({ k: 'confirmed', code: c.code, params: c.params })), openDoc.length ? { k: 'minor_remain' } : { k: 'clean' }];
  }
  const provided = req.filter((k) => has(k) && docs[k].status === 'provided').length;
  const unverified = Object.entries(docs).filter(([k, d]) => k !== 'objection' && d.status === 'provided' && !d.verified).length;
  let next;
  if (app.status === 'returned') next = 'await_applicant';
  else if (restr) next = 'legal_check';
  else if (openDoc.some((x) => x.code === 'doc_missing')) next = 'request_docs';
  else if (openDoc.some((x) => x.code === 'doc_unclear')) next = 'request_clear';
  else if (openDoc.some((x) => x.code === 'duplicate_application')) next = 'compare_records';
  else if (openDoc.some((x) => x.severity === 'high')) next = 'inspect_fields';
  else if (openDoc.some((x) => x.kind === 'unverified')) next = 'field_inquiry';
  else if (openDoc.length) next = 'verify_points';
  else if (unverified) next = 'verify_docs';
  else next = 'ready_decide';
  const std = app.type === 'sale' ? ['std_sale1', 'std_sale2'] : ['std_inh1', 'std_inh2'];
  return {
    generatedAt: Date.now(), engine: 'rules-v2',
    summaryParams: { name: L(app.applicant.name), village: L(app.applicant.village), khasra: app.land.khasra, area: app.land.claimedArea, type: app.type, provided, total: req.length, age: ageDays(app) },
    confirmed, findings: f, nextAction: next, unverified,
    docStatus: [...req, ...(docs.objection ? ['objection'] : [])].map((k) => ({ key: k, status: docs[k]?.status || 'missing' })),
    verify: [...openDoc.filter((x) => x.kind !== 'confirmed' || x.severity !== 'high').map((x) => ({ k: 'finding', ref: x.id })), ...std.map((key) => ({ k: 'std', key }))],
    returnPoints: openDoc.filter((x) => !x.restriction && !(x.severity === 'low' && x.kind === 'potential')).map((x) => ({ id: x.id, code: x.code, doc: x.doc })),
    recommendation: { decision, reasons },
  };
}

export function summarize(app, all) {
  const a = analyze(app, all), dl = daysLeft(app), open = a.findings.filter((x) => x.category === 'doc' && x.open);
  const last = app.returns?.[app.returns.length - 1];
  const resub = app.status === 'pending' && last?.status === 'resubmitted' && Date.now() - last.respondedAt < 7 * DAY;
  const why = [];
  if (dl !== null && dl < 0) why.push({ k: 'overdue', n: -dl }); else if (dl !== null && dl <= 5) why.push({ k: 'due_soon', n: dl });
  if (open.some((x) => x.severity === 'high')) why.push({ k: 'high', n: open.filter((x) => x.severity === 'high').length });
  if (resub) why.push({ k: 'resubmitted' });
  if (app.returns?.length >= 2) why.push({ k: 'repeat_return', n: app.returns.length });
  if (a.nextAction === 'ready_decide' && app.status === 'pending') why.push({ k: 'ready' });
  const tier = app.status !== 'pending' ? 9 : dl < 0 ? 0 : dl <= 5 ? 1 : resub ? 2 : dl <= 10 ? 3 : 4;
  return {
    id: app.id, type: app.type, status: app.status, assignee: app.assignee, queuedBy: app.queuedBy, name: L(app.applicant.name), village: L(app.applicant.village), khasra: app.land.khasra, area: app.land.claimedArea,
    submittedAt: app.submittedAt, decidedAt: app.decidedAt, ageDays: ageDays(app), daysLeft: dl,
    docProblems: Object.entries(app.docs).filter(([k, d]) => k !== 'objection' && d.status !== 'provided').length, unverified: a.unverified,
    high: open.filter((x) => x.severity === 'high').length, issues: open.length, nextAction: a.nextAction, suggestion: a.recommendation.decision, why, tier,
    returnsCount: app.returns?.length || 0, lastReturn: last ? last.status : null, resubmitted: resub, _a: a,
  };
}
