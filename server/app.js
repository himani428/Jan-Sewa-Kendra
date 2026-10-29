import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { USERS, checkPassword, publicUser } from './users.js';
import { analyze, summarize, ageDays, daysLeft } from './analyze.js';
import { freshFields, newFile } from './seed.js';
import { DAY, SLA_DAYS, REQUIRED, today0, startOfDay } from './util.js';
import { L } from './translit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUSES = ['pending', 'returned', 'approved', 'rejected'];
const VIEWS = ['mine', 'urgent', 'docs', 'ready', 'overdue', 'returned', 'all'];
const LABEL = { sale: { hi: 'विक्रय (बैनामा)', en: 'Sale (deed)' }, inheritance: { hi: 'वरासत', en: 'Inheritance' },
  pending: { hi: 'लंबित', en: 'Pending' }, returned: { hi: 'वापस भेजा गया', en: 'Returned' }, approved: { hi: 'स्वीकृत', en: 'Approved' }, rejected: { hi: 'अस्वीकृत', en: 'Rejected' } };

export function createApp({ file, staticDir } = {}) {
  const store = openStore(file), s = store.data;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }); next(); });
  const fail = (res, status, code) => res.status(status).json({ error: code });
  const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
  const prefsOf = (id) => (s.prefs[id] ??= { onboarded: false, read: [], views: [] });

  // ---- stateless signed sessions (survive restarts) ----
  const sign = (b) => crypto.createHmac('sha256', s.secret).update(b).digest('base64url');
  const issue = (uid) => { const b = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 8 * 3600e3 })).toString('base64url'); return `${b}.${sign(b)}`; };
  const auth = (req, res, next) => {
    const [b, sig] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
    try {
      if (!b || !sig || sig !== sign(b)) throw 0;
      const p = JSON.parse(Buffer.from(b, 'base64url')); if (p.exp < Date.now() || !USERS[p.uid]) throw 0;
      req.user = USERS[p.uid]; next();
    } catch { fail(res, 401, 'session_expired'); }
  };
  const tries = new Map();
  app.post('/api/login', (req, res) => {
    const ip = req.ip, rec = tries.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - rec.t > 60000) { rec.n = 0; rec.t = Date.now(); }
    if (rec.n >= 10) return fail(res, 429, 'too_many_attempts');
    const { id, password } = req.body || {};
    const u = typeof id === 'string' ? USERS[id.trim()] : null;
    if (!u || !checkPassword(u, password)) { rec.n++; tries.set(ip, rec); return fail(res, 401, 'invalid_credentials'); }
    res.json({ token: issue(u.id), user: publicUser(u, prefsOf(u.id)) });
  });
  app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user, prefsOf(req.user.id)) }));
  app.post('/api/me/onboarded', auth, (req, res) => { prefsOf(req.user.id).onboarded = req.body?.value !== false; store.save(); res.json({ ok: true }); });
  app.get('/api/officers', auth, (req, res) => res.json({ officers: Object.values(USERS).map((u) => ({ id: u.id, role: u.role, name: u.name, designation: u.designation, pending: s.applications.filter((a) => a.status === 'pending' && a.assignee === u.id).length })) }));

  // ---- helpers ----
  const all = () => s.applications;
  const sum = (a) => summarize(a, all());
  const strip = ({ _a, ...r }) => r;
  const find = (id) => all().find((a) => a.id === id);
  const log = (by, appId, action, x = {}) => {
    const u = typeof by === 'object' ? by : null;
    const e = { id: 'a' + (++s.counters.audit), at: Date.now(), appId, action, by: u ? u.id : by, byName: u ? u.name : null, from: null, to: null, reason: null, ...x };
    s.audit.push(e); return e;
  };
  const scoped = (m, u) => u.role === 'supervisor' || m.assignee === u.id;
  const VIEW = {
    mine: (m, u) => m.status === 'pending' && scoped(m, u), urgent: (m, u) => m.status === 'pending' && scoped(m, u) && m.daysLeft <= 5,
    docs: (m, u) => m.status === 'pending' && scoped(m, u) && m.docProblems > 0, ready: (m, u) => m.status === 'pending' && scoped(m, u) && m.nextAction === 'ready_decide',
    overdue: (m, u) => m.status === 'pending' && scoped(m, u) && m.daysLeft < 0, returned: (m, u) => scoped(m, u) && (m.status === 'returned' || m.resubmitted), all: () => true,
  };
  const searchText = (m) => [m.id, m.name.hi, m.name.en, m.village.hi, m.village.en, m.khasra, LABEL[m.type].hi, LABEL[m.type].en].join(' ').toLowerCase();
  // Status words are matched exactly (Hindi “स्वीकृत” is a substring of “अस्वीकृत”, so substring matching would mix them up).
  const statusOf = (needle) => STATUSES.find((k) => [LABEL[k].hi, LABEL[k].en, k].some((l) => l.toLowerCase() === needle));
  const ymd = (v) => { const t = new Date(v + 'T00:00:00').getTime(); return Number.isNaN(t) ? null : t; };

  function filtered(q, u) {
    const view = VIEWS.includes(q.view) ? q.view : 'all';
    let list = all().map(sum);
    const counts = Object.fromEntries(VIEWS.map((v) => [v, list.filter((m) => VIEW[v](m, u)).length]));
    list = list.filter((m) => VIEW[view](m, u));
    if (STATUSES.includes(q.status)) list = list.filter((m) => m.status === q.status);
    if (['sale', 'inheritance'].includes(q.type)) list = list.filter((m) => m.type === q.type);
    if (q.q) { const t = String(q.q).trim().toLowerCase(), st = statusOf(t); list = list.filter((m) => (st ? m.status === st : searchText(m).includes(t))); }
    if (q.urgency === 'high') list = list.filter((m) => m.status === 'pending' && m.tier <= 1);
    if (q.missing === '1') list = list.filter((m) => m.docProblems > 0);
    if (q.dueOn !== undefined && q.dueOn !== '' && Number.isFinite(+q.dueOn)) list = list.filter((m) => m.daysLeft === +q.dueOn);
    if (q.due && +q.due >= 0) list = list.filter((m) => m.daysLeft !== null && m.daysLeft <= +q.due);
    if (q.assignee === 'me') list = list.filter((m) => m.assignee === u.id); else if (q.assignee === 'none') list = list.filter((m) => !m.assignee); else if (USERS[q.assignee]) list = list.filter((m) => m.assignee === q.assignee);
    if (q.queued === '1') list = list.filter((m) => m.queuedBy === u.id);
    const f = q.from && ymd(q.from), t = q.to && ymd(q.to);
    if (f) list = list.filter((m) => m.submittedAt >= f); if (t) list = list.filter((m) => m.submittedAt < t + DAY);
    const key = { priority: (m) => m.tier * 1e4 + (m.daysLeft ?? 999) * 10 - m.high, deadline: (m) => m.daysLeft ?? 9999, age: (m) => -m.submittedAt, id: (m) => m.id, name: (m) => m.name.en }[q.sort] || ((m) => m.tier * 1e4 + (m.daysLeft ?? 999) * 10 - m.high - (m.tier === 9 ? m.decidedAt / 1e11 : 0));
    const dir = q.dir === 'desc' ? -1 : 1;
    list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);
    return { list, counts, view };
  }

  app.get('/api/applications', auth, (req, res) => {
    const { list, counts } = filtered(req.query, req.user);
    const size = Math.min(Math.max(+req.query.pageSize || 10, 1), 50), pages = Math.max(Math.ceil(list.length / size), 1), page = Math.min(Math.max(+req.query.page || 1, 1), pages);
    res.json({ items: list.slice((page - 1) * size, page * size).map(strip), total: list.length, page, pages, pageSize: size, counts, sla: SLA_DAYS });
  });

  function detail(a, user) {
    const m = strip(sum(a)), keys = [...REQUIRED[a.type], ...(a.docs.objection ? ['objection'] : [])];
    const fld = (f) => ({ ...f, ...(f.name ? { name: L(f.name) } : {}) });
    return {
      ...m, applicant: { ...a.applicant, name: L(a.applicant.name), father: L(a.applicant.father), village: L(a.applicant.village) }, land: a.land, returns: a.returns,
      docs: keys.map((k) => ({ key: k, required: k !== 'objection', ...(a.docs[k] || { status: 'missing', fields: {} }), fields: fld((a.docs[k] || {}).fields || {}), verified: a.docs[k]?.verified || null })),
      notes: s.notes.filter((n) => n.appId === a.id).sort((x, y) => y.at - x.at), tasks: s.tasks.filter((t) => t.appId === a.id).sort((x, y) => x.dueAt - y.dueAt),
      audit: s.audit.filter((e) => e.appId === a.id).sort((x, y) => y.at - x.at), assigneeName: a.assignee ? USERS[a.assignee].name : null,
      canDecide: a.status === 'pending' && (user.role === 'supervisor' || !a.assignee || a.assignee === user.id), slaDays: SLA_DAYS,
    };
  }
  const withApp = (h) => (req, res) => { const a = find(req.params.id); if (!a) return fail(res, 404, 'not_found'); return h(req, res, a); };
  app.get('/api/applications/:id', auth, withApp((req, res, a) => res.json(detail(a, req.user))));
  // `animate` only adds the demo delay so the loading state is visible; `log` records the run in the audit trail.
  app.post('/api/applications/:id/analyze', auth, withApp((req, res, a) => setTimeout(() => {
    const r = analyze(a, all());
    if (req.body?.log === true) { log(req.user, a.id, 'ai_review', { params: { findings: r.findings.length, suggestion: r.recommendation.decision } }); store.save(); }
    res.json(r);
  }, req.body?.animate === true ? 1400 : 0)));

  // ---- decisions ----
  const cleanPoints = (p) => (Array.isArray(p) ? p.slice(0, 10).filter((x) => x && str(x.code, 1, 40)).map((x) => ({ code: x.code.trim(), ...(str(x.doc, 1, 30) ? { doc: x.doc.trim() } : {}) })) : []);
  app.post('/api/applications/:id/decision', auth, withApp((req, res, a) => {
    const { decision, note = '', points, ack } = req.body || {};
    if (!['approved', 'rejected', 'returned'].includes(decision)) return fail(res, 400, 'invalid_decision');
    if (a.status !== 'pending') return fail(res, 409, 'already_decided');
    if (a.assignee && a.assignee !== req.user.id && req.user.role !== 'supervisor') return fail(res, 403, 'not_assigned');
    if (ack !== true) return fail(res, 400, 'ack_required');
    if (typeof note !== 'string' || note.length > 1000) return fail(res, 400, 'invalid_input');
    const pts = cleanPoints(points);
    if (decision === 'rejected' && note.trim().length < 10) return fail(res, 400, 'reason_required');
    if (decision === 'returned' && note.trim().length < 10 && !pts.length) return fail(res, 400, 'points_required');
    const suggested = { approve: 'approved', return: 'returned', reject: 'rejected' }[analyze(a, all()).recommendation.decision];
    const now = Date.now();
    a.status = decision; a.decidedAt = decision === 'returned' ? null : now; a.assignee ||= req.user.id;
    if (decision === 'returned') a.returns.push({ id: 'r' + (a.returns.length + 1), at: now, by: req.user.id, points: pts, note: note.trim(), status: 'awaiting', respondedAt: null });
    log(req.user, a.id, decision, { from: 'pending', to: decision, reason: note.trim() || null, params: { points: pts, suggested, followedAI: suggested === decision } });
    store.save(); res.json(detail(a, req.user));
  }));

  // ---- simulated applicant response (clearly labelled in UI) ----
  app.post('/api/applications/:id/simulate-resubmission', auth, withApp((req, res, a) => {
    const ret = a.returns[a.returns.length - 1];
    if (a.status !== 'returned' || ret?.status !== 'awaiting') return fail(res, 409, 'not_awaiting');
    for (const p of ret.points) {
      if (['doc_missing', 'doc_unclear'].includes(p.code) && a.docs[p.doc]) {
        const d = a.docs[p.doc]; if (d.status === 'missing') d.fields = freshFields(a, p.doc);
        Object.assign(d, { status: 'provided', uploadedAt: Date.now(), file: newFile(p.doc, a.id), verified: null });
      } else if (p.code === 'area_mismatch') { a.docs.khatauni.fields.area = a.land.claimedArea; if (a.docs.deed) a.docs.deed.fields.area = a.land.claimedArea; }
      else if (p.code === 'heirs_mismatch' && a.docs.affidavit) a.docs.affidavit.fields.heirs = a.docs.family_register.fields.heirs;
      else if (p.code.startsWith('name_') && a.docs.aadhaar) a.docs.aadhaar.fields.name = a.applicant.name;
    }
    ret.status = 'resubmitted'; ret.respondedAt = Date.now(); a.status = 'pending';
    log('applicant', a.id, 'resubmitted', { from: 'returned', to: 'pending', params: { simulated: true, via: req.user.id } });
    store.save(); res.json(detail(a, req.user));
  }));

  // ---- findings review, document verification ----
  app.post('/api/applications/:id/findings', auth, withApp((req, res, a) => {
    const { id, state, reason = '' } = req.body || {};
    const f = analyze(a, all()).findings.find((x) => x.id === id);
    if (!f || !['reviewed', 'resolved', 'na', 'open'].includes(state)) return fail(res, 400, 'invalid_input');
    if (['resolved', 'na'].includes(state) && !str(reason, 5, 500)) return fail(res, 400, 'reason_required');
    if (a.status !== 'pending') return fail(res, 409, 'already_decided');
    const prev = a.findingStates[id]?.state || 'open';
    if (state === 'open') delete a.findingStates[id]; else a.findingStates[id] = { state, reason: reason.trim(), by: req.user.id, at: Date.now() };
    log(req.user, a.id, 'finding_marked', { from: prev, to: state, reason: reason.trim() || null, params: { finding: id } });
    store.save(); res.json(detail(a, req.user));
  }));
  app.post('/api/applications/:id/docs/:key/verify', auth, withApp((req, res, a) => {
    const d = a.docs[req.params.key], { verified, note = '' } = req.body || {};
    if (!d || d.status === 'missing' || typeof verified !== 'boolean' || typeof note !== 'string' || note.length > 300) return fail(res, 400, 'invalid_input');
    if (a.status !== 'pending') return fail(res, 409, 'already_decided');
    d.verified = verified ? { by: req.user.id, at: Date.now(), note: note.trim() || null } : null;
    log(req.user, a.id, 'doc_verified', { reason: note.trim() || null, params: { doc: req.params.key, verified } });
    store.save(); res.json(detail(a, req.user));
  }));

  // ---- notes & tasks ----
  app.post('/api/applications/:id/notes', auth, withApp((req, res, a) => {
    if (!str(req.body?.text, 2, 1000)) return fail(res, 400, 'invalid_input');
    const n = { id: 'n' + (++s.counters.note), appId: a.id, by: req.user.id, byName: req.user.name, at: Date.now(), text: req.body.text.trim() };
    s.notes.push(n); log(req.user, a.id, 'note_added', { params: { note: n.id } }); store.save(); res.json(detail(a, req.user));
  }));
  app.post('/api/applications/:id/tasks', auth, withApp((req, res, a) => {
    const due = ymd(String(req.body?.dueDate || ''));
    if (!str(req.body?.title, 3, 200) || !due) return fail(res, 400, 'invalid_input');
    const t = { id: 't' + (++s.counters.task), appId: a.id, title: req.body.title.trim(), dueAt: due, owner: req.user.id, done: false, doneAt: null };
    s.tasks.push(t); log(req.user, a.id, 'task_created', { params: { task: t.id, dueAt: due } }); store.save(); res.json(detail(a, req.user));
  }));
  app.patch('/api/tasks/:id', auth, (req, res) => {
    const t = s.tasks.find((x) => x.id === req.params.id);
    if (!t) return fail(res, 404, 'not_found');
    if (t.owner !== req.user.id && req.user.role !== 'supervisor') return fail(res, 403, 'forbidden');
    if (typeof req.body?.done !== 'boolean') return fail(res, 400, 'invalid_input');
    t.done = req.body.done; t.doneAt = t.done ? Date.now() : null;
    log(req.user, t.appId, t.done ? 'task_done' : 'task_reopened', { params: { task: t.id } }); store.save(); res.json({ ok: true });
  });
  app.get('/api/tasks', auth, (req, res) => {
    const mine = req.query.scope !== 'all' || req.user.role !== 'supervisor';
    const items = s.tasks.filter((t) => !mine || t.owner === req.user.id).map((t) => { const a = find(t.appId); return { ...t, app: a && { id: a.id, name: L(a.applicant.name), village: L(a.applicant.village) }, ownerName: USERS[t.owner]?.name }; });
    res.json({ items: items.sort((x, y) => Number(x.done) - Number(y.done) || x.dueAt - y.dueAt) });
  });

  // ---- assignment & bulk (never decisions) ----
  const assignTo = (a, user, to) => {
    if (to !== null && !USERS[to]) return false;
    const prev = a.assignee; if (prev === to) return true;
    a.assignee = to; log(user, a.id, 'assigned', { from: prev, to, params: { assignee: to } }); return true;
  };
  app.post('/api/applications/:id/assign', auth, withApp((req, res, a) => {
    const to = req.body?.assignee === 'none' ? null : req.body?.assignee;
    if (a.status !== 'pending' || !assignTo(a, req.user, to)) return fail(res, 400, 'invalid_input');
    store.save(); res.json(detail(a, req.user));
  }));
  app.post('/api/bulk', auth, (req, res) => {
    const { ids, action, assignee } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !['assign', 'queue', 'unqueue'].includes(action)) return fail(res, 400, 'invalid_input');
    if (action === 'assign' && assignee !== 'none' && !USERS[assignee]) return fail(res, 400, 'invalid_input');
    let n = 0;
    for (const id of ids) { const a = find(id); if (!a || a.status !== 'pending') continue; n++;
      if (action === 'assign') assignTo(a, req.user, assignee === 'none' ? null : assignee);
      else { const q = action === 'queue' ? req.user.id : null; if (a.queuedBy !== q) { a.queuedBy = q; log(req.user, a.id, action === 'queue' ? 'queued' : 'unqueued'); } } }
    store.save(); res.json({ changed: n });
  });

  // ---- overview / badges ----
  const myTasks = (u) => s.tasks.filter((t) => t.owner === u.id && !t.done);
  app.get('/api/badges', auth, (req, res) => {
    const list = all().map(sum).filter((m) => VIEW.urgent(m, req.user));
    res.json({ urgent: list.length, tasks: myTasks(req.user).filter((t) => t.dueAt <= today0() + DAY).length, unread: notifications(req.user).filter((n) => !n.read).length });
  });
  app.get('/api/overview', auth, (req, res) => {
    const u = req.user, pending = all().map(sum).filter((m) => VIEW.mine(m, u));
    const attention = pending.filter((m) => m.tier <= 3 || m.high > 0 || m.nextAction === 'ready_decide').sort((a, b) => a.tier * 1e4 + a.daysLeft * 10 - a.high - (b.tier * 1e4 + b.daysLeft * 10 - b.high)).slice(0, 5).map(strip);
    const days = Array.from({ length: 14 }, (_, i) => ({ offset: i, date: today0() + i * DAY, count: pending.filter((m) => m.daysLeft === i).length }));
    res.json({ pending: pending.length, urgent: pending.filter((m) => m.tier <= 1).length, overdue: pending.filter((m) => m.daysLeft < 0).length, ready: pending.filter((m) => m.nextAction === 'ready_decide').length,
      attention, needsAttentionTotal: pending.filter((m) => m.tier <= 3 || m.high > 0).length, deadlines: days, laterCount: pending.filter((m) => m.daysLeft > 13).length, sla: SLA_DAYS,
      tasksOpen: myTasks(u).length, tasksOverdue: myTasks(u).filter((t) => t.dueAt < today0()).length });
  });

  // ---- documents needing attention across the officer's pending cases ----
  app.get('/api/documents', auth, (req, res) => {
    const rows = [];
    for (const a of all().filter((x) => x.status === 'pending' && scoped(sum(x), req.user))) {
      for (const k of REQUIRED[a.type]) { const d = a.docs[k]; const st = !d || d.status === 'missing' ? 'missing' : d.status === 'unclear' ? 'unclear' : d.verified ? null : 'unverified';
        if (st) rows.push({ appId: a.id, name: L(a.applicant.name), village: L(a.applicant.village), doc: k, state: st, uploadedAt: d?.uploadedAt || null }); }
    }
    const rank = { missing: 0, unclear: 1, unverified: 2 };
    res.json({ items: rows.sort((x, y) => rank[x.state] - rank[y.state] || x.appId.localeCompare(y.appId)) });
  });

  // ---- notifications (derived from real state; only "read" flags are stored) ----
  function notifications(u) {
    const read = new Set(prefsOf(u.id).read), out = [], now = Date.now();
    for (const a of all().filter((x) => x.assignee === u.id)) {
      const m = sum(a);
      if (a.status === 'pending' && now - a.submittedAt < 3 * DAY) out.push({ id: `new:${a.id}`, type: 'new', appId: a.id, at: a.submittedAt });
      if (m.daysLeft !== null && m.daysLeft <= 7) out.push({ id: `deadline:${a.id}:${m.daysLeft < 0 ? 'late' : 'soon'}`, type: m.daysLeft < 0 ? 'overdue' : 'deadline', appId: a.id, at: today0(), params: { days: Math.abs(m.daysLeft) } });
      const last = a.returns[a.returns.length - 1];
      if (a.status === 'pending' && last?.status === 'resubmitted' && now - last.respondedAt < 5 * DAY) out.push({ id: `resub:${a.id}:${last.respondedAt}`, type: 'resubmitted', appId: a.id, at: last.respondedAt });
    }
    for (const t of myTasks(u)) if (t.dueAt <= today0() + DAY) out.push({ id: `task:${t.id}`, type: t.dueAt < today0() ? 'task_overdue' : 'task_due', appId: t.appId, at: t.dueAt, params: { task: t.title } });
    for (const e of s.audit) if (['approved', 'rejected'].includes(e.action) && e.by !== u.id && now - e.at < 3 * DAY && find(e.appId)?.assignee === u.id) out.push({ id: `status:${e.id}`, type: 'status', appId: e.appId, at: e.at, params: { to: e.to } });
    return out.map((n) => ({ ...n, read: read.has(n.id), name: find(n.appId) && L(find(n.appId).applicant.name) })).sort((a, b) => b.at - a.at);
  }
  app.get('/api/notifications', auth, (req, res) => { const items = notifications(req.user); res.json({ items, unread: items.filter((n) => !n.read).length }); });
  app.post('/api/notifications/read', auth, (req, res) => {
    const p = prefsOf(req.user.id), ids = req.body?.all ? notifications(req.user).map((n) => n.id) : Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string').slice(0, 200) : [];
    p.read = [...new Set([...p.read, ...ids])].slice(-500); store.save(); res.json({ ok: true });
  });

  // ---- saved views ----
  const ALLOWED = ['view', 'q', 'type', 'status', 'urgency', 'missing', 'due', 'dueOn', 'from', 'to', 'assignee', 'queued', 'sort', 'dir'];
  const cleanParams = (p) => Object.fromEntries(Object.entries(p && typeof p === 'object' ? p : {}).filter(([k, v]) => ALLOWED.includes(k) && typeof v === 'string' && v.length <= 80));
  app.get('/api/views', auth, (req, res) => res.json({ items: prefsOf(req.user.id).views }));
  app.post('/api/views', auth, (req, res) => {
    if (!str(req.body?.name, 1, 40)) return fail(res, 400, 'invalid_input');
    const p = prefsOf(req.user.id); if (p.views.length >= 20) return fail(res, 400, 'too_many_views');
    p.views.push({ id: 'v' + (++s.counters.view), name: req.body.name.trim(), nameKey: null, params: cleanParams(req.body.params) }); store.save(); res.json({ items: p.views });
  });
  app.patch('/api/views/:id', auth, (req, res) => {
    const v = prefsOf(req.user.id).views.find((x) => x.id === req.params.id);
    if (!v) return fail(res, 404, 'not_found'); if (!str(req.body?.name, 1, 40)) return fail(res, 400, 'invalid_input');
    v.name = req.body.name.trim(); v.nameKey = null; store.save(); res.json({ items: prefsOf(req.user.id).views });
  });
  app.delete('/api/views/:id', auth, (req, res) => { const p = prefsOf(req.user.id); p.views = p.views.filter((x) => x.id !== req.params.id); store.save(); res.json({ items: p.views }); });

  // ---- audit (read-only API) ----
  app.get('/api/audit', auth, (req, res) => {
    const acts = req.query.actions ? String(req.query.actions).split(',') : null, q = String(req.query.q || '').toLowerCase();
    let items = s.audit.filter((e) => (!acts || acts.includes(e.action)) && (!req.query.appId || e.appId === req.query.appId));
    items = items.map((e) => { const a = find(e.appId); return { ...e, app: a && { id: a.id, name: L(a.applicant.name) } }; })
      .filter((e) => !q || [e.appId, e.app?.name.hi, e.app?.name.en, e.reason, e.byName?.en, e.byName?.hi].join(' ').toLowerCase().includes(q)).sort((a, b) => b.at - a.at);
    const size = 12, pages = Math.max(Math.ceil(items.length / size), 1), page = Math.min(Math.max(+req.query.page || 1, 1), pages);
    res.json({ items: items.slice((page - 1) * size, page * size), total: items.length, page, pages });
  });

  // ---- reports & exports ----
  function rangeOf(q) { const to = q.to && ymd(q.to) != null ? ymd(q.to) + DAY : today0() + DAY, from = q.from && ymd(q.from) != null ? ymd(q.from) : to - 90 * DAY; return [from, to]; }
  app.get('/api/reports', auth, (req, res) => {
    const [from, to] = rangeOf(req.query), inR = (t) => t != null && t >= from && t < to, ms = all().map(sum);
    const submitted = ms.filter((m) => inR(m.submittedAt)), decided = ms.filter((m) => ['approved', 'rejected'].includes(m.status) && inR(m.decidedAt));
    const nDays = Math.min(Math.round((to - from) / DAY), 120), step = nDays > 60 ? 7 : nDays > 31 ? 3 : 1, volume = [];
    for (let t = from; t < to; t += step * DAY) { const r = (x) => x >= t && x < t + step * DAY; volume.push({ date: t, received: submitted.filter((m) => r(m.submittedAt)).length, decided: decided.filter((m) => r(m.decidedAt)).length }); }
    const days = (m) => Math.round((startOfDay(m.decidedAt) - startOfDay(m.submittedAt)) / DAY), avg = (l) => (l.length ? +(l.reduce((x, m) => x + days(m), 0) / l.length).toFixed(1) : null);
    const pend = ms.filter((m) => m.status === 'pending'), bucket = (lo, hi) => pend.filter((m) => m.ageDays >= lo && m.ageDays <= hi).length;
    const ev = s.audit.filter((e) => inR(e.at));
    res.json({ from, to, sla: SLA_DAYS, volume, step,
      byType: ['sale', 'inheritance'].map((k) => ({ key: k, count: submitted.filter((m) => m.type === k).length })), byStatus: STATUSES.map((k) => ({ key: k, count: submitted.filter((m) => m.status === k).length })),
      processing: { avg: avg(decided), withinSla: decided.length ? Math.round((decided.filter((m) => days(m) <= SLA_DAYS).length / decided.length) * 100) : null, count: decided.length, byType: ['sale', 'inheritance'].map((k) => ({ key: k, avg: avg(decided.filter((m) => m.type === k)) })) },
      aging: [['0–15', 0, 15, 'ok'], ['16–30', 16, 30, 'mid'], ['31–45', 31, 45, 'high'], ['45+', 46, 9999, 'late']].map(([label, lo, hi, tone]) => ({ label, count: bucket(lo, hi), tone })),
      returns: { returned: ev.filter((e) => e.action === 'returned').length, resubmitted: ev.filter((e) => e.action === 'resubmitted').length, awaiting: ms.filter((m) => m.status === 'returned').length, repeat: ms.filter((m) => m.returnsCount >= 2).length },
      workload: [...Object.values(USERS).filter((u) => u.role === 'officer').map((u) => u.id), null].map((id) => ({ id, name: id ? USERS[id].name : null, pending: pend.filter((m) => m.assignee === id).length, overdue: pend.filter((m) => m.assignee === id && m.daysLeft < 0).length })) });
  });
  const HEAD = { hi: ['आवेदन क्रमांक', 'प्रकार', 'स्थिति', 'गाँव', 'आवेदन तिथि', 'निर्णय तिथि', 'आयु (दिन)', 'समय-सीमा में शेष (दिन)', 'नियुक्त अधिकारी', 'खुली विसंगतियाँ'], en: ['Application no.', 'Type', 'Status', 'Village', 'Submitted', 'Decided', 'Age (days)', 'Days left to deadline', 'Assigned officer', 'Open findings'] };
  const csvCell = (v) => { let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  app.get('/api/export/applications.csv', auth, (req, res) => {
    const lang = req.query.lang === 'hi' ? 'hi' : 'en', [from, to] = rangeOf(req.query), ids = req.query.ids ? String(req.query.ids).split(',') : null, iso = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '');
    const rows = all().map(sum).filter((m) => (ids ? ids.includes(m.id) : m.submittedAt >= from && m.submittedAt < to));
    const lines = [HEAD[lang], ...rows.map((m) => [m.id, LABEL[m.type][lang], LABEL[m.status][lang], m.village[lang], iso(m.submittedAt), iso(m.decidedAt), m.ageDays, m.daysLeft ?? '', m.assignee ? USERS[m.assignee].name[lang] : '', m.issues])];
    const note = lang === 'hi' ? '# डेमो डेटा — काल्पनिक; आवेदकों के नाम/संपर्क शामिल नहीं' : '# Demo data — fictional; applicant names/contacts excluded';
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="jansewa-applications.csv"' });
    res.send('\ufeff' + [note, ...lines.map((r) => r.map(csvCell).join(','))].join('\r\n'));
  });

  app.post('/api/reset', auth, (req, res) => { store.reset(); res.json({ ok: true }); });

  app.use('/api', (req, res) => fail(res, 404, 'not_found'));
  app.use((e, req, res, next) => { if (res.headersSent) return next(e); console.error(e); fail(res, e.type === 'entity.parse.failed' ? 400 : 500, e.type === 'entity.parse.failed' ? 'invalid_input' : 'server_error'); });
  const dist = staticDir ?? path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) { app.use(express.static(dist)); app.use((req, res) => res.sendFile(path.join(dist, 'index.html'))); }
  return { app, store };
}
