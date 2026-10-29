import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { normalize } from '../i18n';

const day0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Language-aware formatting & data helpers. Stored data is language-neutral; display happens here.
export function useFmt() {
  const { t, i18n } = useTranslation();
  const lang = normalize(i18n.language), loc = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return useMemo(() => {
    const D = (o) => (x) => new Date(x).toLocaleDateString(loc, o);
    const L = (x) => (x == null ? '' : typeof x === 'object' ? x[lang] ?? x.hi : String(x));
    const rp = (p = {}) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v && typeof v === 'object' && 'hi' in v ? L(v) : v]));
    const area = (v) => `${v} ${t('units.hectare')}`;
    const fieldValue = (field, value, valueEn) => {
      if (field === 'area') return area(value);
      if (field === 'date') return D({ day: 'numeric', month: 'long', year: 'numeric' })(value);
      if (field === 'tenure') return t(`tenure.${value}`);
      if (field === 'status') return t(`docStatus.${value}`);
      if (field === 'topic') return t(`topic.${value}`);
      if (field === 'age') return t('time.days', { count: value });
      if (field === 'name') return lang === 'en' && valueEn ? valueEn : L(value);
      return L(value);
    };
    return {
      lang, loc, t, L, rp, area, fieldValue,
      date: D({ day: 'numeric', month: 'long', year: 'numeric' }), short: D({ day: 'numeric', month: 'short' }), weekday: D({ weekday: 'short' }),
      time: (x) => new Date(x).toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' }), num: (n) => Number(n).toLocaleString(loc),
      dateTime: (x) => `${D({ day: 'numeric', month: 'short', year: 'numeric' })(x)}, ${new Date(x).toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })}`,
      rel: (ts) => { const d = Math.round((day0(Date.now()) - day0(ts)) / 864e5); return d <= 0 ? t('time.today') : d === 1 ? t('time.yesterday') : t('time.daysAgo', { count: d }); },
      deadline: (d) => (d < 0 ? t('time.daysLate', { count: -d }) : d === 0 ? t('time.dueToday') : t('time.daysLeft', { count: d })),
      docName: (k) => t(`doc.${k}`),
      fp: (f) => ({ ...rp(f.params), docName: f.doc ? t(`doc.${f.doc}`) : '', a: '', b: '', count: '', days: '', other: '', ...rp(f.params) }),
    };
  }, [lang, loc, t]);
}

export const urgencyTone = (d) => (d < 0 || d <= 5 ? 'brick' : d <= 10 ? 'warn' : 'slate');
export const errText = (t, e) => t(`errors.${e?.code || 'generic'}`, { defaultValue: t('errors.generic') });
export const resume = { get: () => { try { return JSON.parse(localStorage.getItem('jansewa_resume')); } catch { return null; } }, set: (v) => { try { localStorage.setItem('jansewa_resume', JSON.stringify(v)); } catch { /* ignore */ } } };
