import { describe, expect, it } from 'vitest';
import { withShadowPropertyDefaults } from '@/ui/card/shadowCss';

const DEFAULTS_BLOCK = /@layer properties\{:host,\*,::before,::after,::backdrop\{([^}]*)\}\}\s*$/;

function defaultsOf(css: string): string {
  return DEFAULTS_BLOCK.exec(css)?.[1] ?? '';
}

describe('withShadowPropertyDefaults', () => {
  it('declares minified @property initial values on every element of the shadow tree', () => {
    const css = '@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}.border{border-style:var(--tw-border-style)}';
    const out = withShadowPropertyDefaults(css);
    expect(out.startsWith(css)).toBe(true);
    expect(defaultsOf(out)).toBe('--tw-border-style:solid;');
  });

  it('reads unminified rules and values with spaces, commas and parentheses', () => {
    const css = `@property --tw-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
@property --tw-ring-offset-color {
  syntax: "*";
  inherits: false;
  initial-value: rgb(255 255 255 / 0.5);
}`;
    expect(defaultsOf(withShadowPropertyDefaults(css))).toBe('--tw-shadow:0 0 #0000;--tw-ring-offset-color:rgb(255 255 255 / 0.5);');
  });

  it('skips properties that have no initial value', () => {
    const css = '@property --tw-shadow-color{syntax:"*";inherits:false}@property --tw-leading{syntax:"*";inherits:false}';
    expect(withShadowPropertyDefaults(css)).toBe(css);
  });

  it('leaves CSS without @property rules unchanged', () => {
    expect(withShadowPropertyDefaults('.a{color:red}')).toBe('.a{color:red}');
  });
});
