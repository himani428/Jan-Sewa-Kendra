import { describe, expect, it } from 'vitest';
import hi from '../src/i18n/hi.js';
import en from '../src/i18n/en.js';
import { analyze } from '../server/analyze.js';
import { buildSeed } from '../server/seed.js';

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, p + k + '.') : [[p + k, v]]));
const H = Object.fromEntries(flat(hi)), E = Object.fromEntries(flat(en));
const vars = (s) => (typeof s === 'string' ? [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort().join(',') : '');

describe('translation resources', () => {
  it('Hindi and English define exactly the same keys', () => {
    expect(Object.keys(H).filter((k) => !(k in E))).toEqual([]);
    expect(Object.keys(E).filter((k) => !(k in H))).toEqual([]);
  });
  it('interpolation variables match between languages', () => {
    for (const k of Object.keys(E)) expect(vars(H[k]), k).toBe(vars(E[k]));
  });
  it('has no empty strings except intentionally empty applicant requests', () => {
    for (const [k, v] of Object.entries(H)) if (v === '') expect(k).toMatch(/\.ask$/);
    for (const [k, v] of Object.entries(E)) if (v === '') expect(k).toMatch(/\.ask$/);
  });
  it('Hindi strings contain Devanagari and English ones do not (spot check)', () => {
    for (const k of ['login.title', 'nav.queue', 'decision.approve.cta', 'finding.area_mismatch.title']) { expect(H[k]).toMatch(/[\u0900-\u097F]/); expect(E[k]).not.toMatch(/[\u0900-\u097F]/); }
  });
  it('covers every finding code, next action and document key the engine can emit', () => {
    const { applications } = buildSeed(), codes = new Set(), nexts = new Set(), docs = new Set();
    for (const a of applications) { const r = analyze(a, applications); r.findings.forEach((f) => codes.add(f.code)); nexts.add(r.nextAction); r.confirmed.forEach((c) => expect(E[`confirmed.${c.code}`], c.code).toBeTruthy()); Object.keys(a.docs).forEach((d) => docs.add(d)); }
    for (const c of codes) for (const part of ['title', 'explain', 'next', 'ask']) expect(`finding.${c}.${part}` in E && `finding.${c}.${part}` in H, `${c}.${part}`).toBe(true);
    for (const n of [...nexts, 'await_applicant']) expect(E[`next.${n}`] && E[`next.why.${n}`], n).toBeTruthy();
    for (const d of docs) expect(E[`doc.${d}`] && H[`doc.${d}`], d).toBeTruthy();
  });
  it('covers every audit action and seeded reason key', () => {
    const { audit } = buildSeed();
    for (const e of audit) { expect(E[`audit.${e.action}`], e.action).toBeTruthy(); if (e.reasonKey) expect(E[`seed.${e.reasonKey}`] && H[`seed.${e.reasonKey}`], e.reasonKey).toBeTruthy(); }
  });
});
