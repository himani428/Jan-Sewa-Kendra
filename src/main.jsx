import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/500.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/source-serif-4/700.css';
import '@fontsource/noto-serif-devanagari/600.css';
import '@fontsource/noto-serif-devanagari/700.css';
import './index.css';
import './i18n';
import App from './App';
import { AuthProvider, ToastProvider } from './state';

createRoot(document.getElementById('root')).render(
  <MotionConfig reducedMotion="user">
    <BrowserRouter><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></BrowserRouter>
  </MotionConfig>
);
