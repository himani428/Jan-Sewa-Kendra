// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import i18n from '../src/i18n';
import { AuthProvider, ToastProvider } from '../src/state';
import App from '../src/App';
import { start } from './helpers.js';

let S, token; const errors = [];
const realFetch = globalThis.fetch;
beforeAll(async () => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  window.scrollTo = () => {}; Element.prototype.scrollIntoView = () => {};
  S = await start(); token = await S.login('officer');
  globalThis.fetch = (u, o) => realFetch(typeof u === 'string' && u.startsWith('/') ? S.base + u : u, o);
  vi.spyOn(console, 'error').mockImplementation((...a) => { const m = String(a[0]); if (!/not wrapped in act|ReactDOMTestUtils/.test(m)) errors.push(a.map(String).join(' ').slice(0, 300)); });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(async () => { globalThis.fetch = realFetch; await S.close(); });
afterEach(() => { cleanup(); sessionStorage.clear(); });

const T = (k, o) => i18n.t(k, o);
async function mount(route, lang, { auth = true } = {}) {
  await act(async () => { await i18n.changeLanguage(lang); });
  if (auth) sessionStorage.setItem('jansewa_token', token);
  return render(<MemoryRouter initialEntries={[route]}><MotionConfig reducedMotion="always"><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></MotionConfig></MemoryRouter>);
}
const see = (text, { selector, ...w } = {}) => screen.findByText(text, selector ? { selector } : {}, { timeout: 7000, ...w });
const noErrors = () => expect(errors, errors.join('\n')).toEqual([]);

describe('login & language selector', () => {
  it('shows the selector, switches the whole screen instantly, and persists the choice', async () => {
    await mount('/', 'hi', { auth: false });
    await see('लॉग-इन करें', { selector: 'h2' });
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    await see('Sign in', { selector: 'h2' }); expect(localStorage.getItem('jansewa_lang')).toBe('en'); expect(document.documentElement.lang).toBe('en');
    fireEvent.click(screen.getByRole('radio', { name: 'हिन्दी' }));
    await see('लॉग-इन करें', { selector: 'h2' }); expect(localStorage.getItem('jansewa_lang')).toBe('hi');
    noErrors();
  });
  for (const lang of ['hi', 'en']) it(`validates and reports bad credentials in ${lang}`, async () => {
    await mount('/', lang, { auth: false });
    fireEvent.click(screen.getByRole('button', { name: T('login.submit') }));
    await see(T('login.required'));
    fireEvent.change(screen.getByLabelText(T('login.id')), { target: { value: 'officer' } });
    fireEvent.change(screen.getByLabelText(T('login.password')), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: T('login.submit') }));
    await see(T('errors.invalid_credentials'));
  });
  it('signs in with the demo account and keeps the language', async () => {
    await mount('/', 'en', { auth: false });
    fireEvent.click(await screen.findByText(T('login.fill')));
    fireEvent.click(screen.getByRole('button', { name: T('login.submit') }));
    await see(T('overview.needs'), { selector: 'h2' });
    // first-time tour appears once, then is dismissed for good
    await see(T('tour.steps.0.t'));
    fireEvent.click(screen.getByRole('button', { name: T('tour.skip') }));
    await waitFor(() => expect(screen.queryByText(T('tour.steps.0.t'))).toBeNull());
    cleanup(); sessionStorage.setItem('jansewa_token', (await S.j('/api/login', { method: 'POST', body: { id: 'officer', password: 'Jansewa@123' } })).data.token);
    await mount('/', 'en'); await see(T('overview.needs'), { selector: 'h2' }); expect(screen.queryByText(T('tour.steps.0.t'))).toBeNull();
  });
});

const ROUTES = [['/', 'overview.needs'], ['/queue', 'queue.title'], ['/applications', 'queue.allTitle'], ['/documents', 'documents.title'], ['/tasks', 'tasks.title'], ['/history', 'history.title'], ['/reports', 'reports.title'], ['/notifications', 'notifications.title'], ['/settings', 'settings.title']];
describe('every page renders in both languages', () => {
  for (const lang of ['hi', 'en']) for (const [route, key] of ROUTES) it(`${route} (${lang})`, async () => {
    const { container } = await mount(route, lang);
    await see(T(key), { selector: 'h1, h2' });
    expect(container.textContent.length).toBeGreaterThan(80);
    const hasDev = /[\u0900-\u097F]/.test(container.textContent);
    if (lang === 'en') expect(container.textContent.match(/[\u0900-\u097F]+/g)?.join(' ') ?? '').not.toMatch(/(अवलोकन|कार्य-सूची|सभी आवेदन|रिपोर्ट|सेटिंग)/); else expect(hasDev).toBe(true);
    noErrors();
  });
  it('shows the most urgent real case on the overview, localized', async () => {
    await mount('/', 'hi'); await see('पवन कुमार शर्मा');
    await act(async () => { await i18n.changeLanguage('en'); }); await see('Pawan Kumar Sharma');
  });
  it('unknown routes show a recoverable empty state', async () => { await mount('/nope', 'en'); await see(T('errors.not_found')); });
});

describe('work queue', () => {
  it('searches in both languages, filters, and shows a one-click clear on empty results', async () => {
    await mount('/applications?q=ramesh', 'en'); await see('DK-2026-0412'); expect(screen.queryByText('DK-2026-0398')).toBeNull();
    cleanup(); await mount('/applications?q=' + encodeURIComponent('रमेश'), 'hi'); await see('DK-2026-0412');
    cleanup(); await mount('/applications?q=zzzz', 'en'); await see(T('queue.emptyTitle'));
    fireEvent.click(screen.getAllByRole('button', { name: T('common.clearFilters') })[0]); await see('DK-2026-0398');
  });
  it('tabs and counts come from the backend; selecting rows reveals safe bulk actions only', async () => {
    await mount('/queue', 'en'); await see('DK-2026-0398');
    expect(screen.getByRole('tab', { name: new RegExp(T('queue.tabs.overdue')) })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(T('queue.select', { id: 'DK-2026-0398' })));
    await see(T('queue.bulk.note')); expect(screen.queryByRole('button', { name: /approve|reject/i })).toBeNull();
  });
  it('command palette opens with Ctrl+K and navigates to a case', async () => {
    await mount('/', 'en'); await see(T('overview.needs'));
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const box = await screen.findByRole('combobox'); fireEvent.change(box, { target: { value: 'ramesh' } });
    const opt = await screen.findByRole('option', { name: /Ramesh Chand/ }, { timeout: 4000 }); fireEvent.click(opt);
    await see('DK-2026-0412');
  });
});

describe('guided review and decisions', () => {
  for (const lang of ['hi', 'en']) it(`shows evidence-based findings (${lang})`, async () => {
    await mount('/applications/DK-2026-0412?step=issues', lang);
    await see(T('finding.area_mismatch.title'), { selector: 'span' });
    expect(screen.getAllByText(T('kind.confirmed')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T('review.steps.ai')) })); await see(T('ai.demoNote'));
    noErrors();
  });
  it('return-for-clarification workflow updates status, history and the queue', async () => {
    await mount('/applications/DK-2026-0412?step=decide', 'en');
    const opt = await screen.findByRole('button', { name: new RegExp(T('review.decide.return')) }, { timeout: 7000 }); fireEvent.click(opt);
    const dlg = await screen.findByRole('dialog'); const submit = within(dlg).getByRole('button', { name: T('decision.return.cta') });
    expect(submit.disabled).toBe(true);
    const pt = await within(dlg).findByLabelText(T('finding.area_mismatch.title'), {}, { timeout: 7000 }); expect(pt.checked).toBe(true); // suggested point pre-selected once analysis arrives
    fireEvent.click(within(dlg).getByLabelText(T('decision.ack'))); await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(within(dlg).getByText(T('decision.letter'))); expect(within(dlg).getByLabelText(T('decision.letter'), { selector: 'textarea' }).value).toMatch(/DK-2026-0412/);
    fireEvent.click(submit);
    await see(T('decision.done.returned'), { selector: 'p.font-semibold' });
    expect((await S.j('/api/applications/DK-2026-0412', { token })).data.status).toBe('returned');
    expect(screen.getAllByText(T('status.returned')).length).toBeGreaterThan(0);
  });
  it('rejection requires a reason before it can be submitted', async () => {
    await mount('/applications/DK-2026-0415?step=decide', 'hi');
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(T('review.decide.reject')) }, { timeout: 7000 }));
    const dlg = await screen.findByRole('dialog'); const submit = within(dlg).getByRole('button', { name: T('decision.reject.cta') });
    fireEvent.click(within(dlg).getByLabelText(T('decision.ack'))); expect(submit.disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText(T('decision.noteReason')), { target: { value: 'अभिलेख अपूर्ण हैं, इसलिए अस्वीकार' } });
    await waitFor(() => expect(submit.disabled).toBe(false));
  });
  it('notes and tasks from the case tools persist', async () => {
    await mount('/applications/DK-2026-0402', 'en'); await see('DK-2026-0402');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(T('review.tools')) }));
    const ta = await screen.findByLabelText(T('drawer.notes'), { selector: 'textarea' }); fireEvent.change(ta, { target: { value: 'UI test note' } });
    fireEvent.click(screen.getByRole('button', { name: T('drawer.addNote') })); await see('UI test note');
    expect((await S.j('/api/applications/DK-2026-0402', { token })).data.notes[0].text).toBe('UI test note');
    noErrors();
  });
});
