/**
 * Tailwind v4 gives its internal variables (--tw-border-style, --tw-shadow, ...) their default values
 * through CSS `@property` rules, and Chrome ignores `@property` inside a shadow root. Without this,
 * borders, rings and shadows in the card compute to nothing.
 *
 * This copies each rule's initial value onto every element of the shadow tree, inside Tailwind's
 * `properties` layer so any utility class still overrides it. Nothing leaks to the page.
 */
const PROPERTY_RULE = /@property\s+(--[\w-]+)\s*\{([^}]*)\}/g;
const INITIAL_VALUE = /initial-value\s*:\s*([^;]+?)\s*(?:;|$)/;

export function withShadowPropertyDefaults(css: string): string {
  let declarations = '';
  for (const [, name, body] of css.matchAll(PROPERTY_RULE)) {
    const value = INITIAL_VALUE.exec(body ?? '')?.[1];
    if (value) declarations += `${name}:${value};`;
  }
  if (!declarations) return css;
  return `${css}\n@layer properties{:host,*,::before,::after,::backdrop{${declarations}}}`;
}
