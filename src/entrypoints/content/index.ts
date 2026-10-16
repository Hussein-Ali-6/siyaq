import { defineContentScript } from 'wxt/utils/define-content-script';
import cssText from './style.css?inline';
import { SiyaqController } from './controller';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manual',
  main(ctx) {
    if (window !== window.top) return;
    new SiyaqController(ctx, cssText);
  },
});
