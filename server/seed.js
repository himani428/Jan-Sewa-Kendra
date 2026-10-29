// Fictional demo data only. Reasons/titles that are seeded use translation keys or {hi,en} pairs.
import { DAY, REQUIRED, today0 } from './util.js';
import { POOL } from './translit.js';

const at = (d, h = 10, m = 0) => today0() - d * DAY + (h * 60 + m) * 60000;
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const file = (key, id) => ({ name: `${key}_${id.slice(-4)}.pdf`, kb: 120 + (hash(key + id) % 880), mime: 'application/pdf' });

export function freshFields(a, key) {
  const n = a.applicant.name, k = a.land.khasra, ar = a.land.claimedArea;
  const dec = a.docs.death_cert?.fields.name || a.applicant.father.replace('स्व. ', '');
  return ({
    aadhaar: { name: n }, deed: { name: n, area: ar, khasra: k, date: Date.now() - 20 * DAY },
    khatauni: { area: ar, khasra: k, tenure: 'bhumidhar', ...(a.type === 'inheritance' ? { name: dec } : {}) }, stamp: { date: Date.now() - 20 * DAY },
    death_cert: { name: dec, date: Date.now() - 70 * DAY }, family_register: { name: dec, heirs: 3 }, affidavit: { heirs: a.docs.family_register?.fields.heirs ?? 3 },
  })[key] || {};
}
export const newFile = (key, id) => file(key, id);

function docsFor(type, b) {
  const t = (d) => at(d, 0);
  const aadhaar = { status: 'provided', fields: { name: b.aadhaarName || b.name } };
  if (type === 'sale') return {
    aadhaar, deed: { status: 'provided', fields: { name: b.name, area: b.area, khasra: b.khasra, date: t(b.daysAgo + 20) } },
    khatauni: { status: 'provided', fields: { area: b.khatauniArea ?? b.area, khasra: b.khasra, tenure: b.tenure || 'bhumidhar' } },
    stamp: { status: 'provided', fields: { date: t(b.daysAgo + 20) } },
  };
  return {
    aadhaar, death_cert: { status: 'provided', fields: { name: b.deceased, date: t(b.daysAgo + 70) } },
    family_register: { status: 'provided', fields: { name: b.deceased, heirs: b.heirsReg ?? 3 } },
    khatauni: { status: 'provided', fields: { name: b.deceased, area: b.area, khasra: b.khasra, tenure: 'bhumidhar' } },
    affidavit: { status: 'provided', fields: { heirs: b.heirsAff ?? 3 } },
  };
}

function make(o, audit) {
  const docs = docsFor(o.type, o);
  (o.missing || []).forEach((k) => { docs[k] = { status: 'missing', fields: {} }; });
  (o.unclear || []).forEach((k) => { docs[k].status = 'unclear'; });
  if (o.objection) docs.objection = { status: 'provided', fields: { topic: o.objection } };
  const sub = o.daysAgo === 0 ? Date.now() - 45 * 60000 : at(o.daysAgo, 9, 40);
  const officer = o.assignee || 'officer';
  for (const [k, d] of Object.entries(docs)) if (d.status !== 'missing') {
    d.uploadedAt = sub; d.file = file(k, o.id);
    d.verified = o.verified && k !== 'objection' ? { by: officer, at: at(Math.max(o.daysAgo - 3, 0), 12), note: null } : null;
  }
  const ev = (when, action, by, x = {}) => { if (when <= Date.now()) audit.push({ at: when, appId: o.id, action, by, byName: null, from: null, to: null, reason: null, ...x }); };
  ev(sub, 'submitted', 'applicant');
  ev(at(o.daysAgo - 1, 11, 5), 'received', 'office');
  if (o.daysAgo >= 8) ev(at(o.daysAgo - 7, 16, 20), 'lekhpal_report', 'lekhpal');
  if (o.objection) ev(at(Math.max(o.daysAgo - 12, 0), 12), 'objection_received', 'office');
  const returns = (o.returns || []).map((r, i) => {
    const done = r.resolvedD != null;
    ev(at(r.d, 14), 'returned', officer, { from: 'pending', to: 'returned', reasonKey: 'seed_return', params: { points: r.points } });
    if (done) ev(at(r.resolvedD, 11), 'resubmitted', 'applicant', { from: 'returned', to: 'pending', params: { simulated: true } });
    return { id: `r${i + 1}`, at: at(r.d, 14), by: officer, points: r.points, note: '', status: done ? 'resubmitted' : 'awaiting', respondedAt: done ? at(r.resolvedD, 11) : null };
  });
  let status = o.returnedNow ? 'returned' : 'pending', decidedAt = null;
  if (o.decided) {
    status = o.decided.status; decidedAt = at(o.decided.d, 15, 30);
    ev(decidedAt, status, officer, { from: 'pending', to: status, reasonKey: o.decided.reasonKey, params: { followedAI: true } });
  }
  return {
    id: o.id, type: o.type, status, submittedAt: sub, decidedAt, assignee: o.assignee === undefined ? 'officer' : o.assignee, queuedBy: null,
    applicant: { name: o.name, father: o.father, rel: o.rel || 'पिता', village: o.village, mobile: o.mobile },
    land: { khasra: o.khasra, claimedArea: o.area }, docs, returns, findingStates: {},
  };
}

export function buildSeed() {
  const audit = [];
  const S = [
    { id: 'DK-2026-0412', type: 'sale', name: 'रमेश चंद', father: 'हरि सिंह', village: 'नगला बीच', mobile: '98xxxxxx41', khasra: '214', area: 0.482, khatauniArea: 0.428, daysAgo: 41 },
    { id: 'DK-2026-0415', type: 'inheritance', name: 'सुनीता देवी', father: 'स्व. मोहन लाल', rel: 'पति', village: 'बल्देव', mobile: '97xxxxxx08', khasra: '88', area: 0.76, deceased: 'मोहन लाल', daysAgo: 38, missing: ['death_cert'] },
    { id: 'DK-2026-0398', type: 'sale', name: 'पवन कुमार शर्मा', father: 'ओमप्रकाश शर्मा', village: 'राया', mobile: '99xxxxxx52', khasra: '311', area: 1.215, daysAgo: 47, verified: true },
    { id: 'DK-2026-0420', type: 'inheritance', name: 'गीता रानी', aadhaarName: 'गिता रानी', father: 'स्व. बाबूराम', village: 'फरह', mobile: '96xxxxxx73', khasra: '47', area: 0.34, deceased: 'बाबूराम', heirsReg: 4, heirsAff: 3, daysAgo: 29,
      returns: [{ d: 24, points: [{ code: 'heirs_mismatch' }], resolvedD: 18 }, { d: 15, points: [{ code: 'heirs_mismatch' }, { code: 'name_variant', doc: 'aadhaar' }], resolvedD: 9 }] },
    { id: 'DK-2026-0427', type: 'sale', name: 'मुकेश यादव', father: 'रामस्वरूप यादव', village: 'अकबरपुर', mobile: '95xxxxxx19', khasra: '129', area: 0.62, daysAgo: 22, objection: 'boundary' },
    { id: 'DK-2026-0431', type: 'sale', name: 'अनीता सिंह', father: 'सत्यपाल सिंह', village: 'मांट', mobile: '94xxxxxx60', khasra: '56', area: 0.275, daysAgo: 14, unclear: ['stamp'], assignee: 'officer2',
      returns: [{ d: 10, points: [{ code: 'doc_unclear', doc: 'stamp' }], resolvedD: 5 }] },
    { id: 'DK-2026-0433', type: 'inheritance', name: 'राजवीर सिंह', father: 'स्व. करन सिंह', village: 'छाता', mobile: '93xxxxxx27', khasra: '203', area: 0.905, deceased: 'करन सिंह', daysAgo: 9, verified: true },
    { id: 'DK-2026-0436', type: 'sale', name: 'हरपाल सिंह', father: 'गजराज सिंह', village: 'गोवर्धन', mobile: '92xxxxxx85', khasra: '17', area: 0.45, tenure: 'asami', daysAgo: 6, assignee: 'officer2' },
    { id: 'DK-2026-0438', type: 'inheritance', name: 'कमला देवी', father: 'स्व. रामभरोसे', rel: 'पति', village: 'नौहझील', mobile: '91xxxxxx34', khasra: '95', area: 0.18, deceased: 'रामभरोसे', daysAgo: 3, verified: true },
    { id: 'DK-2026-0402', type: 'sale', name: 'दिनेश गुप्ता', aadhaarName: 'दिनेश कुमार गुप्ता', father: 'लक्ष्मण प्रसाद गुप्ता', village: 'सौंख', mobile: '90xxxxxx12', khasra: '402', area: 0.395, daysAgo: 35 },
    { id: 'DK-2026-0441', type: 'inheritance', name: 'पूनम देवी', father: 'स्व. जगदीश', rel: 'पति', village: 'बल्देव', mobile: '89xxxxxx46', khasra: '132', area: 0.21, deceased: 'जगदीश', daysAgo: 1, missing: ['family_register'], assignee: 'officer2' },
    { id: 'DK-2026-0444', type: 'sale', name: 'जितेंद्र सिंह', father: 'भूरे सिंह', village: 'मांट', mobile: '85xxxxxx77', khasra: '151', area: 0.8, daysAgo: 2, assignee: null },
    { id: 'DK-2026-0409', type: 'sale', name: 'जितेंद्र सिंह', father: 'भूरे सिंह', village: 'मांट', mobile: '85xxxxxx03', khasra: '151', area: 0.8, daysAgo: 31, unclear: ['khatauni'], returnedNow: true,
      returns: [{ d: 3, points: [{ code: 'doc_unclear', doc: 'khatauni' }], resolvedD: null }] },
    { id: 'DK-2026-0390', type: 'sale', name: 'सोहनलाल', father: 'पन्नालाल', village: 'फरह', mobile: '88xxxxxx90', khasra: '78', area: 0.52, daysAgo: 38, verified: true, decided: { status: 'approved', d: 4, reasonKey: 'seed_approved_clean' } },
    { id: 'DK-2026-0385', type: 'inheritance', name: 'मीना कुमारी', father: 'स्व. देवीसिंह', village: 'राया', mobile: '87xxxxxx21', khasra: '260', area: 0.66, deceased: 'देवीसिंह', daysAgo: 36, verified: true, decided: { status: 'approved', d: 9, reasonKey: 'seed_approved_heirs' } },
    { id: 'DK-2026-0377', type: 'sale', name: 'बृजेश कुमार', father: 'किशनलाल', village: 'गोवर्धन', mobile: '86xxxxxx57', khasra: '9', area: 0.3, tenure: 'asami', daysAgo: 44, verified: true, decided: { status: 'rejected', d: 6, reasonKey: 'seed_rejected_asami' } },
  ];
  POOL.forEach(([n, , f, , v], i) => {
    const type = i % 2 ? 'inheritance' : 'sale', daysAgo = 30 + i * 4, dur = 12 + ((i * 7) % 18);
    S.push({ id: `DK-2026-${String(360 + i).padStart(4, '0')}`, type, name: n, father: f, rel: /देवी|रानी|वती/.test(n) ? 'पति' : 'पिता', village: v, mobile: `8${i}xxxxxx${10 + i}`, khasra: String(10 + i * 17), area: +(0.2 + ((i * 87) % 1000) / 1000).toFixed(3),
      deceased: f.replace('स्व. ', ''), daysAgo, verified: true, assignee: i % 3 === 0 ? 'officer2' : 'officer', decided: { status: i % 5 === 3 ? 'rejected' : 'approved', d: Math.max(daysAgo - dur, 1), reasonKey: i % 5 === 3 ? 'seed_rejected_misc' : 'seed_approved_clean' } });
  });
  const applications = S.map((o) => make(o, audit));
  audit.sort((a, b) => a.at - b.at);
  audit.forEach((e, i) => { e.id = 'a' + (i + 1); if (USER_NAMES[e.by]) e.byName = USER_NAMES[e.by]; });
  const day = (n) => today0() + n * DAY;
  return {
    applications, audit, counters: { audit: audit.length, note: 2, task: 3, view: 2 },
    notes: [{ id: 'n1', appId: 'DK-2026-0412', by: 'officer', byName: USER_NAMES.officer, at: at(2, 15), text: { hi: 'खतौनी में 0.428 और बैनामे में 0.482 दर्ज है; अंकों के उलटफेर की संभावना।', en: 'Khatauni shows 0.428 while the deed shows 0.482; possible digit transposition.' } }],
    tasks: [
      { id: 't1', appId: 'DK-2026-0412', title: { hi: 'लेखपाल से पैमाइश रिपोर्ट माँगें', en: 'Request measurement report from Lekhpal' }, dueAt: day(1), owner: 'officer', done: false, doneAt: null },
      { id: 't2', appId: 'DK-2026-0427', title: { hi: 'दोनों पक्षों को सुनवाई का नोटिस तैयार करें', en: 'Prepare hearing notice for both parties' }, dueAt: day(3), owner: 'officer', done: false, doneAt: null },
      { id: 't3', appId: 'DK-2026-0415', title: { hi: 'आवेदक को मृत्यु प्रमाण पत्र के बारे में सूचित करें', en: 'Inform applicant about the death certificate' }, dueAt: day(-1), owner: 'officer', done: false, doneAt: null },
    ],
    prefs: { officer: { onboarded: false, read: [], views: [
      { id: 'v1', name: null, nameKey: 'savedSeed.week', params: { view: 'mine', due: '7' } },
      { id: 'v2', name: null, nameKey: 'savedSeed.docs', params: { view: 'docs' } },
    ] } },
  };
}
const USER_NAMES = {
  officer: { hi: 'श्री अजय प्रताप सिंह', en: 'Shri Ajay Pratap Singh' }, officer2: { hi: 'श्रीमती नीलम वर्मा', en: 'Smt. Neelam Verma' }, supervisor: { hi: 'श्री राजेश तिवारी', en: 'Shri Rajesh Tiwari' },
};
export { REQUIRED };
