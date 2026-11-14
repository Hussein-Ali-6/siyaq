import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Siyaq — context dictionary',
    description: 'Understand English words and sentences in context, with translation into your language, powered by the AI model you choose.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://api.anthropic.com/*'],
    // Requested at runtime only when the reader turns a provider on.
    optional_host_permissions: [
      'https://api.openai.com/*',
      'https://auth.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://openrouter.ai/*',
    ],
    // Only for Sign in with ChatGPT: lets the extension read the sign-in tab's loopback redirect.
    optional_permissions: ['tabs'],
    action: { default_title: 'Siyaq' },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
