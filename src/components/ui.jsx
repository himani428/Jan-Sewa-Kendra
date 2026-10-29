import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Loader2, X, AlertTriangle, Inbox, Info } from 'lucide-react';
import { errText } from '../lib/fmt';

const TONE = {
  moss: 'bg-moss-100 text-moss-700 ring-moss-600/25', warn: 'bg-warn-100 text-warn-700 ring-warn-600/30', brick: 'bg-brick-100 text-brick-700 ring-brick-600/25',
  slate: 'bg-slate-100 text-slate-700 ring-slate-400/30', saffron: 'bg-saffron-100 text-saffron-700 ring-saffron-500/30', ink: 'bg-ink-900 text-ivory-50 ring-ink-700',
};
const DOT = { moss: 'bg-moss-600', warn: 'bg-warn-600', brick: 'bg-brick-600', slate: 'bg-slate-400', saffron: 'bg-saffron-500', ink: 'bg-saffron-400' };
export const STATUS_TONE = { pending: 'warn', returned: 'slate', approved: 'moss', rejected: 'brick' };
export const SEV_TONE = { high: 'brick', medium: 'warn', low: 'slate' };
export const KIND_TONE = { confirmed: 'ink', potential: 'saffron', unverified: 'slate' };

export function Badge({ tone = 'slate', dot, children, className = '' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ring-1 ring-inset whitespace-nowrap ${TONE[tone]} ${className}`}>{dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />}{children}</span>;
}
export function StatusBadge({ status }) { const { t } = useTranslation(); return <Badge tone={STATUS_TONE[status]} dot>{t(`status.${status}`)}</Badge>; }

const BTN = {
  primary: 'bg-ink-900 text-ivory-50 hover:bg-ink-800', outline: 'bg-ivory-50 border border-ivory-300 text-ink-900 hover:bg-ivory-100 hover:border-ivory-400',
  warn: 'bg-ivory-50 border border-warn-600/40 text-warn-700 hover:bg-warn-100', danger: 'bg-ivory-50 border border-brick-600/35 text-brick-700 hover:bg-brick-100',
  saffron: 'bg-saffron-500 text-ink-950 hover:bg-saffron-400 font-semibold', ghost: 'text-ink-600 hover:bg-ivory-200', dark: 'text-ink-300 hover:bg-ink-800 hover:text-ivory-50',
};
export function Button({ variant = 'outline', size = 'md', icon: I, loading, children, className = '', ...p }) {
  return (
    <motion.button type="button" whileTap={p.disabled || loading ? undefined : { scale: 0.97 }} transition={{ duration: 0.1 }} disabled={p.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed ${size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2 text-sm'} ${BTN[variant]} ${className}`} {...p}>
      {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : I && <I size={size === 'sm' ? 14 : 16} aria-hidden />}{children}
    </motion.button>
  );
}

export function Tooltip({ text, children }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute z-40 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[240px] rounded-md bg-ink-900 px-2.5 py-1.5 text-xs leading-snug text-ivory-50 opacity-0 translate-y-1 transition duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100">{text}</span>
    </span>
  );
}
export const HelpTip = ({ text, label = 'info' }) => <Tooltip text={text}><button type="button" aria-label={`${label}: ${text}`} className="text-ink-400 hover:text-ink-900"><Info size={14} /></button></Tooltip>;
export const Skeleton = ({ className = '' }) => <div aria-hidden className={`rounded-md bg-ivory-200 animate-shimmer motion-reduce:animate-none ${className}`} />;

export function EmptyState({ title, text, action, icon: I = Inbox }) {
  return <div className="py-12 px-6 text-center"><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-ivory-200 text-ink-400"><I size={20} /></div><p className="font-semibold">{title}</p>{text && <p className="text-sm text-ink-600 mt-1 max-w-sm mx-auto">{text}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
export function ErrorState({ error, onRetry }) {
  const { t } = useTranslation();
  return <div className="panel p-8 text-center max-w-lg mx-auto mt-10" role="alert"><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-brick-100 text-brick-600"><AlertTriangle size={20} /></div><p className="font-semibold">{t('errors.title')}</p><p className="text-sm text-ink-600 mt-1">{errText(t, error)}</p>{onRetry && <Button variant="primary" className="mt-4" onClick={onRetry}>{t('common.retry')}</Button>}</div>;
}

// Number that animates briefly when its value changes.
export function Num({ value, className = '' }) {
  return <span className={`inline-block overflow-hidden align-bottom num ${className}`}><AnimatePresence mode="popLayout" initial={false}><motion.span key={value} className="inline-block" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.2 }}>{value}</motion.span></AnimatePresence></span>;
}

export function Dialog({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const k = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter((x) => !x.disabled);
        if (!f.length) return; const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    const id = setTimeout(() => (ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('textarea,input,button'))?.focus(), 60);
    return () => { clearTimeout(id); document.removeEventListener('keydown', k); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center bg-ink-950/55 p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className={`bg-ivory-50 w-full ${width} rounded-t-2xl sm:rounded-xl shadow-pop max-h-[92vh] flex flex-col`}>
            <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-3 border-b rule">
              <div><h2 className="font-serif text-xl font-bold">{title}</h2>{subtitle && <p className="text-sm text-ink-400">{subtitle}</p>}</div>
              <button type="button" onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-md text-ink-400 hover:bg-ivory-200"><X size={18} /></button>
            </div>
            <div className="px-5 sm:px-6 py-4 overflow-y-auto">{children}</div>
            {footer && <div className="px-5 sm:px-6 py-4 border-t rule flex flex-wrap justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Click-outside popover used for menus (bell, profile, saved views, assign).
export function Popover({ trigger, children, align = 'right', label, width = 'w-80' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o), 'aria-haspopup': 'true', 'aria-expanded': open, 'aria-label': label })}
      <AnimatePresence>
        {open && <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }} className={`absolute z-50 mt-2 ${width} max-w-[92vw] ${align === 'right' ? 'right-0' : 'left-0'} rounded-lg border border-ivory-300 bg-ivory-50 shadow-pop`}>{typeof children === 'function' ? children(() => setOpen(false)) : children}</motion.div>}
      </AnimatePresence>
    </div>
  );
}
