import './settings-stub';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui/pages.css';
import { App } from '../src/entrypoints/options/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
