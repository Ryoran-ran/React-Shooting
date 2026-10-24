import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';

const StageEditor = lazy(() => import('./app/StageEditor').then((module) => ({ default: module.StageEditor })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.pathname === '/editor'
    ? <Suspense fallback={<main className="stage-editor">エディタを読み込んでいます…</main>}><StageEditor /></Suspense>
    : <App />}</StrictMode>,
);
