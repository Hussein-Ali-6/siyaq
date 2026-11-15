import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Prefs } from '@/lib/types';
import { SetupCard } from './SetupCard';
import type { SetupState } from './status';

const prefs: Prefs = { theme: 'dark', language: 'es', level: 'B2' };
const render = (state: SetupState, finished = false) =>
  renderToStaticMarkup(<SetupCard state={state} finished={finished} prefs={prefs} onGoToProvider={() => undefined} onDismiss={() => undefined} />);

describe('SetupCard', () => {
  it('welcomes a new reader with their language and level and a button to connect a provider', () => {
    const html = render({ kind: 'welcome' });
    expect(html).toContain('Welcome to Siyaq');
    expect(html).toContain('Español · Upper-intermediate (B2)');
    expect(html).toContain('Connect a provider');
    expect(html).not.toContain('Got it');
  });

  it('shows nothing on a page that opened ready', () => {
    expect(render({ kind: 'ready', provider: 'anthropic' })).toBe('');
  });

  it('turns to the last step when a new reader has connected a provider', () => {
    const html = render({ kind: 'ready', provider: 'openai' }, true);
    expect(html).toContain('You&#x27;re ready');
    expect(html).toContain('Lookups use OpenAI.');
    expect(html).toContain('Got it');
    expect(html).not.toContain('Connect a provider');
  });

  it('says why lookups cannot work and offers to fix it', () => {
    const html = render({ kind: 'problem', provider: 'openai', reason: 'No model is chosen for OpenAI.' });
    expect(html).toContain('Lookups are not working');
    expect(html).toContain('No model is chosen for OpenAI.');
    expect(html).toContain('Fix it');
  });
});
