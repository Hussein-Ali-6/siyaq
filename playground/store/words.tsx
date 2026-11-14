import '../settings-stub';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/ui/pages.css';
import { App } from '../../src/entrypoints/words/App';
import { savedItems } from './fixtures';

await chrome.storage.local.set({ saved: savedItems });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
