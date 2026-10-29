import { useTranslation } from 'react-i18next';
import { Badge } from './ui';
import { useFmt, urgencyTone } from '../lib/fmt';

const WHY_TONE = { overdue: 'brick', due_soon: 'warn', high: 'brick', resubmitted: 'saffron', repeat_return: 'warn', ready: 'moss' };
export function WhyChips({ why = [], max = 3 }) {
  const { t } = useTranslation();
  return <span className="flex flex-wrap gap-1">{why.slice(0, max).map((w) => <Badge key={w.k} tone={WHY_TONE[w.k]}>{t(`why.${w.k}`, { count: w.n })}</Badge>)}</span>;
}
const TXT = { brick: 'text-brick-700', warn: 'text-warn-700', slate: 'text-ink-600' };
export function Deadline({ m }) {
  const f = useFmt();
  if (m.status !== 'pending') return <span className="text-[13px] text-ink-600">{f.t(`status.${m.status}`)}{m.decidedAt ? ` · ${f.short(m.decidedAt)}` : ''}</span>;
  return <span className="block text-[13px]"><span className={`font-semibold ${TXT[urgencyTone(m.daysLeft)]}`}>{f.deadline(m.daysLeft)}</span><span className="block text-xs text-ink-400">{f.t('time.pendingFor', { count: m.ageDays })}</span></span>;
}
export const download = (blob, name) => { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
