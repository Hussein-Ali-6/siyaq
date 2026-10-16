import { createRoot, type Root } from 'react-dom/client';
import { CardApp } from './CardApp';
import type { CardActions, CardState } from './state';

export interface CardUi {
  host: HTMLElement;
  render(state: CardState, actions: CardActions): void;
  destroy(): void;
}

/** Events that must not reach the page's own listeners while interacting with the card. */
const ISOLATED_EVENTS = [
  'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu',
  'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel',
  'keydown', 'keyup', 'keypress',
];

/** Creates the shadow host, injects the card stylesheet and mounts React inside it. */
export function createCardUi(doc: Document, cssText: string, hostTag: string): CardUi {
  const host = doc.createElement(hostTag);
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  shadow.adoptedStyleSheets = [sheet];
  const mount = doc.createElement('div');
  shadow.append(mount);
  for (const type of ISOLATED_EVENTS) host.addEventListener(type, (e) => e.stopPropagation());
  (doc.documentElement ?? doc.body).append(host);
  const root: Root = createRoot(mount);
  return {
    host,
    render(state, actions) {
      root.render(<CardApp state={{ ...state }} actions={actions} />);
    },
    destroy() {
      root.unmount();
      host.remove();
    },
  };
}
