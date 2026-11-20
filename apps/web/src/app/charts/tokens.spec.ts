import { DARK_TOKENS, DEFAULT_FONT, markRadius, readTokens } from './tokens';

describe('chart tokens', () => {
  let el: HTMLElement;
  beforeEach(() => {
    el = document.createElement('div');
    document.body.append(el);
  });
  afterEach(() => el.remove());

  it('falls back to the default themes where a theme declares nothing', () => {
    const t = readTokens(el);
    expect(t.font).toBe(DEFAULT_FONT);
    expect(t.cmpDash).toEqual([4, 4]);
    expect(t.markRadius).toBe(4);
    expect(t.cat).toEqual(DARK_TOKENS.cat);
  });

  it("draws with a theme's own font, categorical scale, dash and mark radius", () => {
    const concept: Record<string, string> = {
      '--card': '#ffffff',
      '--series': '#477ee3',
      '--series-cmp': '#65779d',
      '--font-sans': "'Archivo', sans-serif",
      '--cat-1': '#477ee3',
      '--cat-2': '#00595b',
      '--cat-3': '#b28319',
      '--cat-4': '#7b285d',
      '--cat-5': '#229666',
      '--chart-cmp-dash': '4 3',
      '--chart-bar-radius': '2px',
    };
    for (const [name, value] of Object.entries(concept)) el.style.setProperty(name, value);
    const t = readTokens(el);
    expect(t.mode).toBe('light');
    expect(t.font).toBe("'Archivo', sans-serif");
    expect(t.cat).toEqual(['#477ee3', '#00595b', '#b28319', '#7b285d', '#229666']);
    // The comparison period keeps its own colour; it is no longer the third category.
    expect(t.cmp).toBe('#65779d');
    expect(t.cmpDash).toEqual([4, 3]);
    expect(t.markRadius).toBe(2);
  });

  it('caps a mark radius at what the theme allows', () => {
    const square = { ...DARK_TOKENS, markRadius: 2 };
    expect(markRadius(DARK_TOKENS, 3)).toBe(3);
    expect(markRadius(square, 3)).toBe(2);
    expect(markRadius(square, [0, 4, 4, 0])).toEqual([0, 2, 2, 0]);
  });
});
