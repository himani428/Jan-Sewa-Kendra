import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { start } from './helpers.js';

let S, T, T2, TS;
beforeAll(async () => { S = await start(); T = await S.login('officer'); T2 = await S.login('officer2'); TS = await S.login('supervisor'); });
afterAll(() => S.close());
const get = (p, t = T) => S.j(p, { token: t });
const post = (p, body, t = T) => S.j(p, { method: 'POST', body, token: t });
const analysis = async (id) => (await post(`/api/applications/${id}/analyze`, {})).data;

describe('authentication & authorization', () => {
  it('rejects wrong credentials with a translatable code', async () => {
    const r = await S.j('/api/login', { method: 'POST', body: { id: 'officer', password: 'nope' } });
    expect(r.status).toBe(401); expect(r.data.error).toBe('invalid_credentials');
  });
  it('accepts the documented demo login', async () => { expect(T).toBeTruthy(); });
  it('rejects unauthenticated and tampered tokens', async () => {
    expect((await S.j('/api/overview')).status).toBe(401);
    expect((await get('/api/overview', T.slice(0, -3) + 'abc')).status).toBe(401);
  });
  it('keeps a decision on someone else’s case forbidden for officers, allowed for supervisors', async () => {
    const body = { decision: 'rejected', note: 'Restricted land category, see findings', ack: true };
    expect((await post('/api/applications/DK-2026-0436/decision', body, T)).status).toBe(403);
    expect((await post('/api/applications/DK-2026-0436/decision', body, TS)).status).toBe(200);
  });
});

describe('listing, search, filters', () => {
  it('scopes tabs to the officer and returns counts', async () => {
    const r = (await get('/api/applications?view=mine')).data;
    expect(r.items.every((m) => m.assignee === 'officer' && m.status === 'pending')).toBe(true);
    expect(r.counts.all).toBeGreaterThan(r.counts.mine);
  });
  it('searches by English name, Hindi name, service type and status', async () => {
    expect((await get('/api/applications?q=ramesh')).data.total).toBe(1);
    expect((await get('/api/applications?q=' + encodeURIComponent('रमेश'))).data.total).toBe(1);
    expect((await get('/api/applications?q=inheritance&status=pending')).data.items.every((m) => m.type === 'inheritance')).toBe(true);
    expect((await get('/api/applications?q=' + encodeURIComponent('स्वीकृत'))).data.items.every((m) => m.status === 'approved')).toBe(true);
  });
  it('filters by missing documents, deadline and paginates', async () => {
    expect((await get('/api/applications?view=all&missing=1&status=pending')).data.items.every((m) => m.docProblems > 0)).toBe(true);
    expect((await get('/api/applications?view=mine&due=7')).data.items.every((m) => m.daysLeft <= 7)).toBe(true);
    const p1 = (await get('/api/applications?view=all&pageSize=5&page=1')).data, p2 = (await get('/api/applications?view=all&pageSize=5&page=2')).data;
    expect(p1.items.length).toBe(5); expect(p1.items[0].id).not.toBe(p2.items[0].id); expect(p1.pages).toBeGreaterThan(1);
  });
  it('ranks by operational urgency only (overdue first)', async () => {
    const r = (await get('/api/applications?view=mine')).data.items;
    expect(r[0].daysLeft).toBeLessThan(0);
    expect(JSON.stringify(r[0])).not.toMatch(/caste|religion|gender/i);
  });
});

describe('explainable analysis', () => {
  it('flags the area mismatch with evidence and suggests return', async () => {
    const a = await analysis('DK-2026-0412'), f = a.findings.find((x) => x.code === 'area_mismatch');
    expect(f.kind).toBe('confirmed'); expect(f.evidence.map((e) => e.doc)).toEqual(expect.arrayContaining(['application', 'deed', 'khatauni']));
    expect(a.recommendation.decision).toBe('return'); expect(a.engine).toMatch(/rules/);
  });
  it('suggests rejection for non-transferable land but never decides', async () => {
    expect((await analysis('DK-2026-0377')).recommendation.decision).toBe('reject');
    expect((await get('/api/applications/DK-2026-0436')).data.status).toBeDefined();
  });
  it('detects a duplicate parcel and repeated returns', async () => {
    expect((await analysis('DK-2026-0444')).findings.some((x) => x.code === 'duplicate_application')).toBe(true);
    expect((await analysis('DK-2026-0420')).findings.some((x) => x.code === 'repeat_return')).toBe(true);
  });
  it('marks unverified claims as such, and clean cases ready to decide', async () => {
    expect((await analysis('DK-2026-0427')).findings.find((x) => x.code === 'objection_unverified').kind).toBe('unverified');
    expect((await analysis('DK-2026-0433')).nextAction).toBe('ready_decide');
  });
  it('lets the officer resolve a finding (reason required) and the suggestion updates', async () => {
    const id = 'DK-2026-0415';
    expect((await post(`/api/applications/${id}/findings`, { id: 'doc_missing:death_cert', state: 'resolved' })).data.error).toBe('reason_required');
    expect((await post(`/api/applications/${id}/findings`, { id: 'doc_missing:death_cert', state: 'na', reason: 'Not needed here' })).status).toBe(200);
    expect((await analysis(id)).findings.find((x) => x.id === 'doc_missing:death_cert').open).toBe(false);
  });
});

describe('decisions, consistency and audit', () => {
  it('validates input', async () => {
    const id = 'DK-2026-0398';
    expect((await post(`/api/applications/${id}/decision`, { decision: 'approved' })).data.error).toBe('ack_required');
    expect((await post(`/api/applications/${id}/decision`, { decision: 'rejected', ack: true, note: 'short' })).data.error).toBe('reason_required');
    expect((await post(`/api/applications/${id}/decision`, { decision: 'returned', ack: true, note: '' })).data.error).toBe('points_required');
    expect((await post(`/api/applications/${id}/decision`, { decision: 'maybe', ack: true })).data.error).toBe('invalid_decision');
  });
  it('approves, then overview, list, history and audit all agree', async () => {
    const before = (await get('/api/overview')).data.pending;
    const r = await post('/api/applications/DK-2026-0398/decision', { decision: 'approved', ack: true, note: 'Verified' });
    expect(r.status).toBe(200); expect(r.data.status).toBe('approved');
    expect((await get('/api/overview')).data.pending).toBe(before - 1);
    expect((await get('/api/applications?q=0398')).data.items[0].status).toBe('approved');
    const e = r.data.audit[0];
    expect(e).toMatchObject({ action: 'approved', from: 'pending', to: 'approved', by: 'officer', reason: 'Verified' });
    expect((await get('/api/audit?actions=approved&q=0398')).data.items.length).toBe(1);
    expect((await post('/api/applications/DK-2026-0398/decision', { decision: 'rejected', ack: true, note: 'second attempt here' })).status).toBe(409);
  });
  it('audit records cannot be edited or deleted through the API', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) expect((await S.j('/api/audit/a1', { method, token: T, body: { reason: 'x' } })).status).toBe(404);
  });
  it('returns with points, then simulated resubmission applies corrections and reopens the case', async () => {
    const id = 'DK-2026-0412';
    const r = await post(`/api/applications/${id}/decision`, { decision: 'returned', ack: true, note: '', points: [{ code: 'area_mismatch' }] });
    expect(r.data.status).toBe('returned'); expect(r.data.returns.at(-1).status).toBe('awaiting');
    expect((await post(`/api/applications/${id}/decision`, { decision: 'approved', ack: true })).status).toBe(409);
    const s = await post(`/api/applications/${id}/simulate-resubmission`, {});
    expect(s.data.status).toBe('pending'); expect(s.data.returns.at(-1).status).toBe('resubmitted');
    expect((await analysis(id)).findings.some((x) => x.code === 'area_mismatch')).toBe(false);
    expect(s.data.audit.some((e) => e.action === 'resubmitted' && e.params.simulated)).toBe(true);
  });
});

describe('notes, tasks, documents, assignment, bulk', () => {
  it('stores notes and tasks and validates them', async () => {
    const id = 'DK-2026-0433';
    expect((await post(`/api/applications/${id}/notes`, { text: 'x' })).status).toBe(400);
    const n = await post(`/api/applications/${id}/notes`, { text: 'Called the Lekhpal' });
    expect(n.data.notes[0].text).toBe('Called the Lekhpal');
    expect((await post(`/api/applications/${id}/tasks`, { title: 'Follow up', dueDate: 'not-a-date' })).status).toBe(400);
    const t = await post(`/api/applications/${id}/tasks`, { title: 'Follow up', dueDate: '2030-01-05' });
    const task = t.data.tasks.at(-1); expect(task.done).toBe(false);
    expect((await S.j(`/api/tasks/${task.id}`, { method: 'PATCH', body: { done: true }, token: T2 })).status).toBe(403);
    expect((await S.j(`/api/tasks/${task.id}`, { method: 'PATCH', body: { done: true }, token: T })).status).toBe(200);
    expect((await get('/api/tasks')).data.items.find((x) => x.id === task.id).done).toBe(true);
  });
  it('records document verification with the officer and note', async () => {
    const r = await post('/api/applications/DK-2026-0438/docs/aadhaar/verify', { verified: false });
    expect(r.data.docs.find((d) => d.key === 'aadhaar').verified).toBe(null);
    const v = await post('/api/applications/DK-2026-0438/docs/aadhaar/verify', { verified: true, note: 'Original seen' });
    expect(v.data.docs.find((d) => d.key === 'aadhaar').verified.by).toBe('officer');
    expect((await post('/api/applications/DK-2026-0415/docs/death_cert/verify', { verified: true })).status).toBe(400);
  });
  it('assigns cases and offers only safe bulk actions', async () => {
    expect((await post('/api/bulk', { ids: ['DK-2026-0444'], action: 'assign', assignee: 'officer2' })).data.changed).toBe(1);
    expect((await get('/api/applications/DK-2026-0444')).data.assignee).toBe('officer2');
    expect((await post('/api/bulk', { ids: ['DK-2026-0444'], action: 'approve' })).status).toBe(400);
    expect((await post('/api/bulk', { ids: ['DK-2026-0402'], action: 'queue' })).data.changed).toBe(1);
    expect((await get('/api/applications?view=mine&queued=1')).data.items.map((m) => m.id)).toContain('DK-2026-0402');
  });
  it('lists documents needing attention', async () => {
    const items = (await get('/api/documents')).data.items;
    expect(items.some((x) => x.state === 'unverified')).toBe(true);
    expect(items.every((x) => ['missing', 'unclear', 'unverified'].includes(x.state))).toBe(true);
  });
});

describe('views, notifications, reports, export', () => {
  it('manages saved views per officer', async () => {
    const add = await post('/api/views', { name: 'Overdue mine', params: { view: 'overdue', bogus: 'x' } });
    const v = add.data.items.at(-1); expect(v.params).toEqual({ view: 'overdue' });
    expect((await S.j(`/api/views/${v.id}`, { method: 'PATCH', body: { name: 'Late' }, token: T })).data.items.at(-1).name).toBe('Late');
    expect((await S.j(`/api/views/${v.id}`, { method: 'DELETE', token: T })).data.items.find((x) => x.id === v.id)).toBeUndefined();
    expect((await get('/api/views', T2)).data.items).toEqual([]);
    expect((await post('/api/views', { name: '' })).status).toBe(400);
  });
  it('derives notifications from real state and persists read flags', async () => {
    const n = (await get('/api/notifications')).data; expect(n.unread).toBeGreaterThan(0);
    await post('/api/notifications/read', { ids: [n.items[0].id] });
    expect((await get('/api/notifications')).data.unread).toBe(n.unread - 1);
    await post('/api/notifications/read', { all: true }); expect((await get('/api/badges')).data.unread).toBe(0);
  });
  it('reports real aggregates for a date range', async () => {
    const r = (await get('/api/reports')).data;
    expect(r.volume.reduce((s, v) => s + v.received, 0)).toBe(r.byType.reduce((s, v) => s + v.count, 0));
    expect(r.aging).toHaveLength(4); expect(r.processing.count).toBeGreaterThan(0);
    expect((await get('/api/reports?from=2020-01-01&to=2020-01-31')).data.byType.every((x) => x.count === 0)).toBe(true);
  });
  it('exports CSV without applicant names and labels it as demo data', async () => {
    const r = await S.j('/api/export/applications.csv?lang=en', { token: T });
    expect(r.status).toBe(200); expect(r.data).toMatch(/Demo data/); expect(r.data).toMatch(/DK-2026-0412/);
    expect(r.data).not.toMatch(/Ramesh|रमेश/);
    expect((await S.j('/api/export/applications.csv', { token: null })).status).toBe(401);
  });
});

describe('persistence', () => {
  it('survives a restart (file-backed store, sessions stay valid)', async () => {
    await post('/api/applications/DK-2026-0402/notes', { text: 'Persisted note' });
    const S2 = await start(S.file);
    const d = (await S2.j('/api/applications/DK-2026-0402', { token: T })).data;
    expect(d.notes.some((n) => n.text === 'Persisted note')).toBe(true);
    await S2.close();
  });
});
