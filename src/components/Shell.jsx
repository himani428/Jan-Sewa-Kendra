import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ListChecks, FileText, FileSearch, CheckSquare, History, BarChart3, Bell, Settings as Cog, Search, Menu, X, LogOut, Keyboard, ChevronRight, CornerDownLeft } from 'lucide-react';
import { useAuth, useData } from '../state';
import { api, qs } from '../api';
import { Button, Dialog, Popover, Badge } from './ui';
import LanguageSwitch from './LanguageSwitch';
import { useFmt } from '../lib/fmt';

const ShellCtx = createContext(null);
export const useShell = () => useContext(ShellCtx);

export const Brand = ({ dark = true }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-ivory-50 text-ink-900 font-serif text-xl font-bold leading-none">ज<span className="absolute bottom-1 h-[3px] w-4 rounded bg-saffron-500" /></span>
      <div className="leading-tight"><p className={`font-serif text-[17px] font-bold ${dark ? 'text-ivory-50' : 'text-ink-900'}`}>{t('app.name')}</p><p className="text-[12px] text-ink-300">{t('app.tagline')}</p></div>
    </div>
  );
};

const GROUPS = [
  { k: 'workspace', items: [{ to: '/', k: 'overview', icon: LayoutDashboard, end: true }, { to: '/queue', k: 'queue', icon: ListChecks, badge: 'urgent' }, { to: '/applications', k: 'applications', icon: FileText }] },
  { k: 'verify', items: [{ to: '/documents', k: 'documents', icon: FileSearch }, { to: '/tasks', k: 'tasks', icon: CheckSquare, badge: 'tasks' }] },
  { k: 'records', items: [{ to: '/history', k: 'history', icon: History }, { to: '/reports', k: 'reports', icon: BarChart3 }] },
];
const link = ({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-[14.5px] transition-colors ${isActive ? 'bg-ink-700 text-ivory-50 shadow-[inset_3px_0_0_#E8832A]' : 'text-ink-300 hover:bg-ink-800 hover:text-ivory-50'}`;

function Sidebar({ onNavigate }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { badges } = useData();
  const f = useFmt();
  return (
    <div className="flex h-full flex-col bg-ink-900 p-4 text-ivory-50">
      <div className="px-1 pt-1"><Brand /></div>
      <nav className="mt-6 flex-1 space-y-5 overflow-y-auto" aria-label={t('nav.main')}>
        {GROUPS.map((g) => (
          <div key={g.k}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t(`nav.${g.k}`)}</p>
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} className={link}>
                <i.icon size={17} aria-hidden /><span className="flex-1">{t(`nav.${i.k}`)}</span>
                {i.badge && badges[i.badge] > 0 && <span className="num rounded-full bg-saffron-500 px-1.5 text-[11px] font-semibold text-ink-950">{badges[i.badge]}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-ink-700 pt-3">
        <NavLink to="/notifications" onClick={onNavigate} className={link}><Bell size={17} /><span className="flex-1">{t('nav.notifications')}</span>{badges.unread > 0 && <span className="num rounded-full bg-saffron-500 px-1.5 text-[11px] font-semibold text-ink-950">{badges.unread}</span>}</NavLink>
        <NavLink to="/settings" onClick={onNavigate} className={link}><Cog size={17} /><span>{t('nav.settings')}</span></NavLink>
        {onNavigate && <div className="px-1 py-2"><LanguageSwitch dark id="drawer" /></div>}
        <div className="mt-2 rounded-lg bg-ink-800 p-3 text-sm"><p className="font-semibold leading-snug">{f.L(user.name)}</p><p className="text-[12.5px] text-ink-300">{f.L(user.designation)}</p></div>
      </div>
    </div>
  );
}

export function useNotifText() {
  const f = useFmt();
  return (n) => f.t(`notifications.type.${n.type}`, { ...f.rp(n.params), name: f.L(n.name), task: f.L(n.params?.task), to: n.params?.to ? f.t(`status.${n.params.to}`) : '' });
}

function Bell_() {
  const f = useFmt(); const { t } = f; const nav = useNavigate(); const text = useNotifText();
  const { badges, refreshBadges } = useData();
  const [items, setItems] = useState([]);
  const load = () => api.notifications().then((r) => setItems(r.items.slice(0, 6))).catch(() => {});
  return (
    <Popover label={t('header.notifications')} width="w-[360px]" trigger={({ toggle, ...p }) => (
      <button type="button" onClick={() => { toggle(); load(); }} {...p} className="relative rounded-lg border border-ivory-300 bg-ivory-50 p-2 text-ink-600 hover:border-ivory-400">
        <Bell size={18} />{badges.unread > 0 && <span className="num absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-saffron-500 px-1 text-[10px] font-bold text-ink-950">{badges.unread}</span>}
      </button>)}>
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b rule px-4 py-3"><p className="font-semibold">{t('notifications.title')}</p>
            <button className="text-[13px] font-medium text-saffron-700 hover:underline" onClick={async () => { await api.readNotifs({ all: true }); load(); refreshBadges(); }}>{t('notifications.markAll')}</button></div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-400">{t('notifications.empty')}</li>}
            {items.map((n) => (
              <li key={n.id}><button className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-ivory-100" onClick={async () => { await api.readNotifs({ ids: [n.id] }); refreshBadges(); close(); nav(`/applications/${n.appId}`); }}>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-ivory-300' : 'bg-saffron-500'}`} /><span className="text-[13.5px] leading-snug">{text(n)}<span className="block text-xs text-ink-400">{f.rel(n.at)}</span></span></button></li>
            ))}
          </ul>
          <button onClick={() => { close(); nav('/notifications'); }} className="w-full border-t rule px-4 py-2.5 text-left text-[13px] font-medium text-saffron-700 hover:bg-ivory-100">{t('notifications.viewAll')} →</button>
        </div>)}
    </Popover>
  );
}

function Profile() {
  const f = useFmt(); const { t } = f; const { user, logout } = useAuth(); const nav = useNavigate(); const { openHelp } = useShell();
  return (
    <Popover label={t('header.profile')} width="w-64" trigger={({ toggle, ...p }) => (
      <button type="button" onClick={toggle} {...p} className="flex items-center gap-2 rounded-lg border border-ivory-300 bg-ivory-50 py-1.5 pl-1.5 pr-3 hover:border-ivory-400">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-[13px] font-semibold text-ivory-50">{f.L(user.name).replace(/^(श्री|श्रीमती|Shri|Smt\.)\s*/, '').charAt(0)}</span>
        <span className="hidden text-left text-[13px] leading-tight md:block"><span className="block font-medium">{f.L(user.name).replace(/^(श्री|श्रीमती|Shri|Smt\.)\s*/, '')}</span><span className="block text-ink-400">{t(`settings.role.${user.role}`)}</span></span>
      </button>)}>
      {(close) => (
        <div className="py-1 text-sm">
          <div className="border-b rule px-4 py-3"><p className="font-semibold">{f.L(user.name)}</p><p className="text-ink-400">{f.L(user.designation)} · {f.L(user.office)}</p></div>
          <button className="flex w-full items-center gap-2 px-4 py-2 hover:bg-ivory-100" onClick={() => { close(); nav('/settings'); }}><Cog size={15} />{t('header.settings')}</button>
          <button className="flex w-full items-center gap-2 px-4 py-2 hover:bg-ivory-100" onClick={() => { close(); openHelp(); }}><Keyboard size={15} />{t('header.help')}</button>
          <button className="flex w-full items-center gap-2 px-4 py-2 text-brick-700 hover:bg-ivory-100" onClick={logout}><LogOut size={15} />{t('header.signOut')}</button>
        </div>)}
    </Popover>
  );
}

function Palette({ open, onClose, openHelp, openTour }) {
  const f = useFmt(); const { t, lang } = f; const nav = useNavigate(); const { badges } = useData();
  const [q, setQ] = useState(''); const [idx, setIdx] = useState(0); const [cases, setCases] = useState([]); const [views, setViews] = useState([]);
  const { i18n } = useTranslation();
  useEffect(() => { if (open) { setQ(''); setIdx(0); setCases([]); api.views().then((r) => setViews(r.items)).catch(() => {}); } }, [open]);
  useEffect(() => { if (!open || !q.trim()) { setCases([]); return; } const id = setTimeout(() => api.list({ q: q.trim(), pageSize: 6 }).then((r) => setCases(r.items)).catch(() => {}), 150); return () => clearTimeout(id); }, [q, open]);
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const go = [['/', 'nav.overview'], ['/queue', 'nav.queue'], ['/applications', 'nav.applications'], ['/documents', 'nav.documents'], ['/tasks', 'nav.tasks'], ['/history', 'nav.history'], ['/reports', 'nav.reports'], ['/notifications', 'nav.notifications'], ['/settings', 'nav.settings']]
      .map(([to, k]) => ({ k: to, group: 'go', label: t(k), run: () => nav(to) })).filter((i) => !needle || i.label.toLowerCase().includes(needle));
    const acts = [
      { k: 'urgent', group: 'actions', label: `${t('palette.urgent')}${badges.urgent ? ` (${badges.urgent})` : ''}`, run: () => nav('/queue?view=urgent') },
      { k: 'help', group: 'actions', label: t('palette.help'), run: openHelp }, { k: 'tour', group: 'actions', label: t('palette.tour'), run: openTour },
      { k: 'lang', group: 'actions', label: t('palette.lang', { lang: lang === 'hi' ? 'English' : 'हिन्दी' }), run: () => i18n.changeLanguage(lang === 'hi' ? 'en' : 'hi') },
    ].filter((i) => !needle || i.label.toLowerCase().includes(needle));
    const vs = views.map((v) => ({ k: `v${v.id}`, group: 'views', label: v.nameKey ? t(v.nameKey) : v.name, run: () => nav(`/queue?${qs(v.params)}`) })).filter((i) => !needle || i.label.toLowerCase().includes(needle));
    const cs = cases.map((c) => ({ k: c.id, group: 'cases', label: `${f.L(c.name)} — ${f.L(c.village)}`, sub: `${c.id} · ${t(`type.${c.type}`)}`, status: c.status, run: () => nav(`/applications/${c.id}`) }));
    return [...cs, ...go, ...vs, ...acts];
  }, [q, cases, views, t, lang, badges.urgent]); // eslint-disable-line
  const choose = (it) => { if (it) { onClose(); it.run(); } };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(items[idx]); }
  };
  let last = null;
  return (
    <Dialog open={open} onClose={onClose} title={t('palette.title')} subtitle={t('palette.hint')} width="max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border border-ivory-300 bg-white px-3 focus-within:border-saffron-500"><Search size={16} className="text-ink-400" />
        <input data-autofocus role="combobox" aria-expanded="true" aria-controls="pal-list" value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={key} placeholder={t('palette.placeholder')} aria-label={t('palette.title')} className="w-full bg-transparent py-2.5 text-[15px] outline-none" />
        {q && <button type="button" onClick={() => setQ('')} aria-label={t('common.clear')} className="text-ink-400"><X size={15} /></button>}</div>
      <ul id="pal-list" role="listbox" className="mt-2 max-h-80 overflow-y-auto">
        {items.length === 0 && <li className="py-8 text-center text-sm text-ink-400">{t('palette.empty')}</li>}
        {items.map((it, i) => { const head = it.group !== last ? (last = it.group) : null; return (
          <li key={it.k} role="presentation">
            {head && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t(`palette.groups.${head}`)}</p>}
            <button role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => choose(it)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left ${i === idx ? 'bg-ivory-200' : ''}`}>
              <span><span className="block text-[14.5px] font-medium">{it.label}</span>{it.sub && <span className="block text-xs text-ink-400">{it.sub}</span>}</span>
              {it.status ? <Badge tone="slate">{t(`status.${it.status}`)}</Badge> : i === idx && <CornerDownLeft size={14} className="text-ink-400" />}
            </button></li>); })}
      </ul>
    </Dialog>
  );
}

function Shortcuts({ open, onClose }) {
  const { t } = useTranslation();
  const rows = [['Ctrl/⌘ K', 'palette'], ['/', 'slash'], ['?', 'help'], ['G  then  O / Q / A', 'go'], ['J / K', 'move'], ['Enter', 'open'], ['Esc', 'esc']];
  return (
    <Dialog open={open} onClose={onClose} title={t('shortcuts.title')} footer={<Button variant="primary" onClick={onClose}>{t('common.close')}</Button>}>
      <dl className="divide-y rule">{rows.map(([k, r]) => <div key={r} className="flex items-center justify-between gap-4 py-2.5 text-sm"><dd className="order-2 text-ink-600">{t(`shortcuts.rows.${r}`)}</dd><dt className="order-1 shrink-0"><kbd className="rounded border border-ivory-300 bg-ivory-100 px-2 py-0.5 font-mono text-[12.5px]">{k}</kbd></dt></div>)}</dl>
      <p className="mt-3 text-xs text-ink-400">{t('shortcuts.note')}</p>
    </Dialog>
  );
}

function Tour({ open, onClose }) {
  const { t } = useTranslation();
  const steps = t('tour.steps'); const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  const last = i === steps.length - 1;
  return (
    <Dialog open={open} onClose={onClose} title={steps[i]?.t} subtitle={t('tour.of', { n: i + 1, total: steps.length })}
      footer={<><Button variant="ghost" onClick={onClose}>{t('tour.skip')}</Button>{i > 0 && <Button onClick={() => setI(i - 1)}>{t('tour.back')}</Button>}<Button variant="primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? t('tour.finish') : t('tour.next')}</Button></>}>
      <AnimatePresence mode="wait"><motion.p key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-[15px] text-ink-600">{steps[i]?.d}</motion.p></AnimatePresence>
      <div className="mt-4 flex gap-1.5" aria-hidden>{steps.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? 'bg-saffron-500' : 'bg-ivory-300'}`} />)}</div>
    </Dialog>
  );
}

export default function Shell({ children }) {
  const { t } = useTranslation();
  const { user, setOnboarded } = useAuth(); const nav = useNavigate();
  const [drawer, setDrawer] = useState(false), [palette, setPalette] = useState(false), [help, setHelp] = useState(false), [tour, setTour] = useState(!user.onboarded);
  const gRef = useRef(0);
  const openHelp = useCallback(() => setHelp(true), []), openTour = useCallback(() => setTour(true), []), openPalette = useCallback(() => setPalette(true), []);
  const closeTour = useCallback(() => { setTour(false); if (!user.onboarded) setOnboarded(true); }, [user.onboarded, setOnboarded]);
  useEffect(() => {
    const k = (e) => {
      const el = document.activeElement, typing = el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable), modal = !!document.querySelector('[aria-modal="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing || modal || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setPalette(true); }
      else if (e.key === '?') { e.preventDefault(); setHelp(true); }
      else if (e.key.toLowerCase() === 'g') gRef.current = Date.now();
      else if (Date.now() - gRef.current < 900) { const to = { o: '/', q: '/queue', a: '/applications' }[e.key.toLowerCase()]; if (to) { gRef.current = 0; nav(to); } }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [nav]);
  const ctx = useMemo(() => ({ openHelp, openTour, openPalette }), [openHelp, openTour, openPalette]);
  return (
    <ShellCtx.Provider value={ctx}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-ink-900 focus:px-3 focus:py-2 focus:text-ivory-50">{t('common.skipToContent')}</a>
      <div className="min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar /></aside>
        <AnimatePresence>
          {drawer && (<>
            <motion.div className="fixed inset-0 z-40 bg-ink-950/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden" initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
              <Sidebar onNavigate={() => setDrawer(false)} />
              <button onClick={() => setDrawer(false)} aria-label={t('header.menuClose')} className="absolute right-3 top-4 p-2 text-ink-300"><X size={20} /></button>
            </motion.aside>
          </>)}
        </AnimatePresence>
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b rule bg-ivory-100/92 px-4 py-2.5 backdrop-blur sm:gap-3 sm:px-8">
            <button onClick={() => setDrawer(true)} className="-ml-2 rounded-md p-2 hover:bg-ivory-200 lg:hidden" aria-label={t('header.menuOpen')}><Menu size={22} /></button>
            <button onClick={openPalette} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2 text-sm text-ink-400 hover:border-ivory-400 sm:max-w-md" aria-label={t('header.search')}>
              <Search size={16} /><span className="hidden flex-1 truncate text-left sm:inline">{t('header.search')}</span><kbd className="hidden rounded border border-ivory-300 bg-ivory-100 px-1.5 text-[11px] sm:inline">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-2"><div className="hidden sm:block"><LanguageSwitch id="hdr" /></div><Bell_ /><Profile /></div>
          </header>
          <main id="main" className="mx-auto max-w-[1360px] px-4 py-6 sm:px-8">{children}</main>
        </div>
        <Palette open={palette} onClose={() => setPalette(false)} openHelp={openHelp} openTour={openTour} />
        <Shortcuts open={help} onClose={() => setHelp(false)} />
        <Tour open={tour} onClose={closeTour} />
      </div>
    </ShellCtx.Provider>
  );
}
