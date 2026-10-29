import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth, DataProvider } from './state';
import Shell from './components/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Queue from './pages/Queue';
import Review from './pages/Review';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { Documents, Tasks, DecisionHistory, Notifications } from './pages/Lists';
import { EmptyState, Button } from './components/ui';

export default function App() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="grid min-h-screen place-items-center text-ink-400" role="status">{t('common.loading')}</div>;
  if (!user) return <Login />;
  return (
    <DataProvider>
      <Shell>
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <Routes location={loc}>
              <Route path="/" element={<Overview />} />
              <Route path="/queue" element={<Queue mode="queue" />} />
              <Route path="/applications" element={<Queue mode="all" />} />
              <Route path="/applications/:id" element={<Review />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/history" element={<DecisionHistory />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<EmptyState title={t('errors.not_found')} action={<Link to="/"><Button variant="primary">{t('nav.overview')}</Button></Link>} />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Shell>
    </DataProvider>
  );
}
