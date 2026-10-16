import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manual',
  main() {
    // Selection watcher and card are wired up in a later step.
  },
});
