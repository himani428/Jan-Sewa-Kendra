import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { api, getToken, setToken } from './api';

const Auth = createContext(null), Toasts = createContext(null), Data = createContext(null);
export const useAuth = () => useContext(Auth);
export const useToast = () => useContext(Toasts);
export const useData = () => useContext(Data);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  useEffect(() => {
    if (getToken()) api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
    const out = () => setUser(null);
    window.addEventListener('jansewa:logout', out);
    return () => window.removeEventListener('jansewa:logout', out);
  }, []);
  const value = useMemo(() => ({
    user, ready,
    login: async (id, password) => { const r = await api.login({ id, password }); setToken(r.token); setUser(r.user); },
    logout: () => { setToken(null); setUser(null); },
    setOnboarded: async (v) => { setUser((u) => ({ ...u, onboarded: v })); try { await api.onboarded(v); } catch { /* ignore */ } },
  }), [user, ready]);
  return <Auth.Provider value={value}>{children}</Auth.Provider>;
}

const ICON = { success: CheckCircle2, warning: AlertTriangle, error: XCircle };
export function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((s) => s.filter((x) => x.id !== id)), []);
  const push = useCallback((tone, title, text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s.slice(-2), { id, tone, title, text }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);
  const value = useMemo(() => ({ success: (a, b) => push('success', a, b), warning: (a, b) => push('warning', a, b), error: (a, b) => push('error', a, b) }), [push]);
  return (
    <Toasts.Provider value={value}>
      {children}
      <div className="fixed z-[90] right-4 bottom-4 flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((x) => { const I = ICON[x.tone]; return (
            <motion.div key={x.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="bg-ink-900 text-ivory-50 rounded-lg shadow-pop px-4 py-3 flex gap-3 items-start">
              <I size={18} className={`mt-1 shrink-0 ${x.tone === 'success' ? 'text-moss-100' : x.tone === 'warning' ? 'text-saffron-400' : 'text-brick-100'}`} aria-hidden />
              <div className="flex-1 text-sm"><p className="font-semibold">{x.title}</p>{x.text && <p className="text-ink-300 text-[13px]">{x.text}</p>}</div>
              <button onClick={() => dismiss(x.id)} aria-label={t('a11y.dismiss')} className="text-ink-300 hover:text-white mt-1"><X size={15} /></button>
            </motion.div>); })}
        </AnimatePresence>
      </div>
    </Toasts.Provider>
  );
}

export function DataProvider({ children }) {
  const [badges, setBadges] = useState({ urgent: 0, tasks: 0, unread: 0 });
  const [officers, setOfficers] = useState([]);
  const refreshBadges = useCallback(() => api.badges().then(setBadges).catch(() => {}), []);
  useEffect(() => { refreshBadges(); api.officers().then((r) => setOfficers(r.officers)).catch(() => {}); }, [refreshBadges]);
  const value = useMemo(() => ({ badges, officers, refreshBadges, officerName: (id) => officers.find((o) => o.id === id)?.name || null }), [badges, officers, refreshBadges]);
  return <Data.Provider value={value}>{children}</Data.Provider>;
}

// Small async-loading hook used by pages: keeps API calls out of presentation components.
export function useLoad(fn, deps) {
  const [s, setS] = useState({ loading: true, error: null, data: null });
  const run = useCallback(() => { setS((x) => ({ ...x, loading: true, error: null })); return fn().then((data) => setS({ loading: false, error: null, data })).catch((error) => setS((x) => ({ ...x, loading: false, error }))); }, deps); // eslint-disable-line
  useEffect(() => { run(); }, [run]);
  return { ...s, reload: run };
}
