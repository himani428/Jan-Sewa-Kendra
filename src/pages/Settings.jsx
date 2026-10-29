import { useState } from 'react';
import { Keyboard, PlayCircle, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { useAuth, useToast } from '../state';
import { Button, Dialog } from '../components/ui';
import LanguageSwitch from '../components/LanguageSwitch';
import { useShell } from '../components/Shell';
import { errText, useFmt } from '../lib/fmt';

const Row = ({ title, hint, children }) => <section className="panel p-5"><h2 className="font-semibold">{title}</h2>{hint && <p className="mb-3 text-[13.5px] text-ink-600">{hint}</p>}<div className="mt-3">{children}</div></section>;
export default function Settings() {
  const f = useFmt(); const { t } = f; const { user } = useAuth(); const { openHelp, openTour } = useShell(); const toast = useToast();
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const reset = async () => { setBusy(true); try { await api.reset(); setConfirm(false); toast.success(t('settings.resetDone')); } catch (e) { toast.error(errText(t, e)); } finally { setBusy(false); } };
  return (
    <div className="max-w-2xl space-y-4">
      <header><h1 className="font-serif text-[1.75rem] font-bold">{t('settings.title')}</h1><p className="text-ink-600">{t('settings.sub')}</p></header>
      <Row title={t('settings.language')} hint={t('settings.languageHint')}><LanguageSwitch id="settings" /></Row>
      <Row title={t('settings.account')}><p className="font-medium">{f.L(user.name)}</p><p className="text-sm text-ink-600">{f.L(user.designation)} · {t(`settings.role.${user.role}`)}</p><p className="text-sm text-ink-400">{f.L(user.office)}</p></Row>
      <Row title={t('settings.help')}><div className="flex flex-wrap gap-2"><Button icon={PlayCircle} onClick={openTour}>{t('settings.tour')}</Button><Button icon={Keyboard} onClick={openHelp}>{t('settings.shortcuts')}</Button></div></Row>
      <Row title={t('settings.assumptions')}><ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">{t('settings.assumptionsList', { days: 45 }).map((a) => <li key={a}>{a}</li>)}</ul></Row>
      <Row title={t('settings.demo')} hint={t('settings.demoText')}><Button variant="danger" icon={RotateCcw} onClick={() => setConfirm(true)}>{t('settings.reset')}</Button></Row>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t('settings.resetConfirm')} footer={<><Button onClick={() => setConfirm(false)}>{t('common.cancel')}</Button><Button variant="danger" loading={busy} onClick={reset}>{t('settings.reset')}</Button></>}><p className="text-sm text-ink-600">{t('settings.resetConfirmText')}</p></Dialog>
    </div>
  );
}
