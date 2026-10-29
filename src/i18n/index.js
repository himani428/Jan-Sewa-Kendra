import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import hi from './hi';
import en from './en';

export const LANG_KEY = 'jansewa_lang';
export const normalize = (l) => (String(l).startsWith('en') ? 'en' : 'hi');
const stored = (() => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } })();
i18n.use(initReactI18next).init({
  resources: { hi: { translation: hi }, en: { translation: en } },
  lng: normalize(stored || 'hi'), fallbackLng: 'en', interpolation: { escapeValue: false }, returnObjects: true,
});
const apply = (l) => { document.documentElement.lang = l; try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };
apply(i18n.language);
i18n.on('languageChanged', (l) => apply(normalize(l)));
export default i18n;
