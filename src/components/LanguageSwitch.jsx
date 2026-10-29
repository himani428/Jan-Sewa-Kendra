import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { normalize } from '../i18n';

// Segmented control. Switching is instant, persisted (localStorage) and keeps the session/data untouched.
export default function LanguageSwitch({ dark = false, id = 'lang' }) {
  const { t, i18n } = useTranslation();
  const cur = normalize(i18n.language);
  return (
    <div role="radiogroup" aria-label={t('lang.label')} className={`inline-flex items-center gap-1 rounded-full p-1 text-[13px] ${dark ? 'bg-ink-800 text-ink-300' : 'bg-ivory-50 border border-ivory-300 text-ink-600'}`}>
      <Languages size={14} className="ml-2 mr-1 opacity-70" aria-hidden />
      {['hi', 'en'].map((l) => (
        <button key={l} type="button" role="radio" aria-checked={cur === l} lang={l} onClick={() => i18n.changeLanguage(l)} className="relative rounded-full px-3 py-1 font-medium">
          {cur === l && <motion.span layoutId={`${id}-pill`} className={`absolute inset-0 rounded-full ${dark ? 'bg-saffron-500' : 'bg-ink-900'}`} transition={{ duration: 0.2 }} />}
          <span className={`relative ${cur === l ? (dark ? 'text-ink-950' : 'text-ivory-50') : ''}`}>{t(`lang.${l}`)}</span>
        </button>
      ))}
    </div>
  );
}
