import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, FileCheck2, Scale, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../state';
import { Button } from '../components/ui';
import { Brand } from '../components/Shell';
import LanguageSwitch from '../components/LanguageSwitch';
import { errText } from '../lib/fmt';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [id, setId] = useState(''), [pw, setPw] = useState(''), [show, setShow] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const points = [[FileCheck2, 'match'], [Scale, 'why'], [ShieldCheck, 'human']];
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!id.trim() || !pw) return setErr(t('login.required'));
    setBusy(true);
    try { await login(id.trim(), pw); } catch (x) { setErr(errText(t, x)); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink-900 p-12 text-ivory-50 lg:flex">
        <div className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full border border-ink-700" aria-hidden /><div className="absolute -right-10 -top-10 h-[26rem] w-[26rem] rounded-full border border-ink-800" aria-hidden />
        <Brand />
        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-semibold text-saffron-400">{t('login.eyebrow')}</p>
          <h1 className="font-serif text-[2.35rem] font-bold leading-[1.35]">{t('login.hero')}</h1>
          <ul className="mt-10 space-y-5">{points.map(([I, k]) => <li key={k} className="flex gap-4"><span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-800 text-saffron-400"><I size={18} /></span><div><p className="font-semibold">{t(`login.points.${k}.t`)}</p><p className="text-sm text-ink-300">{t(`login.points.${k}.d`)}</p></div></li>)}</ul>
        </div>
        <p className="text-xs text-ink-300">{t('common.demoNote')}</p>
      </section>
      <section className="relative flex items-center justify-center p-6 pt-20 sm:p-12">
        <div className="absolute right-4 top-4 sm:right-8 sm:top-6"><LanguageSwitch id="login" /></div>
        <motion.form onSubmit={submit} noValidate initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden [&_p]:!text-ink-900"><Brand dark={false} /></div>
          <h2 className="font-serif text-3xl font-bold">{t('login.title')}</h2>
          <p className="mb-7 mt-1 text-ink-600">{t('login.subtitle')}</p>
          <label className="mb-1 block text-sm font-medium" htmlFor="uid">{t('login.id')}</label>
          <input id="uid" className="input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" />
          <label className="mb-1 mt-4 block text-sm font-medium" htmlFor="pw">{t('login.password')}</label>
          <div className="relative">
            <input id="pw" className="input pr-11" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('login.hide') : t('login.show')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {err && <p role="alert" className="mt-3 rounded-lg bg-brick-100 px-3 py-2 text-sm text-brick-700">{err}</p>}
          <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full !py-2.5">{t('login.submit')}</Button>
          <div className="mt-6 rounded-lg border border-dashed border-ivory-400 bg-ivory-50 p-4 text-sm">
            <p className="font-semibold">{t('login.demoTitle')}</p>
            <p className="mt-1 text-ink-600 num">{t('login.demoHint', { id: 'officer', pw: 'Jansewa@123' })}</p>
            <p className="mt-1 text-xs text-ink-400">{t('login.other')}</p>
            <button type="button" onClick={() => { setId('officer'); setPw('Jansewa@123'); setErr(''); }} className="mt-2 font-medium text-saffron-700 underline underline-offset-4">{t('login.fill')}</button>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
