import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Siyaq — context dictionary',
    description: 'Context-aware English to Arabic dictionary and translation, powered by Claude.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://api.anthropic.com/*'],
    action: { default_title: 'Siyaq' },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
