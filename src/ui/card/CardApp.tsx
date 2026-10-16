import { CardFrame } from './CardFrame';
import { TriggerIcon } from './TriggerIcon';
import type { CardActions, CardState } from './state';

export function CardApp({ state, actions }: { state: CardState; actions: CardActions }) {
  return (
    <div className={`siyaq ${state.theme === 'light' ? 'theme-light' : ''}`}>
      {state.icon && <TriggerIcon x={state.icon.x} y={state.icon.y} onOpen={actions.openFromIcon} />}
      {state.card && <CardFrame state={state} actions={actions} />}
    </div>
  );
}
