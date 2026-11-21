import { classifyToken, readToken, readTokens, readTokensOf, shortValue, toMs, toPx } from './token-reader';

describe('token reader', () => {
  it('tells a colour from its value, in every notation the themes use', () => {
    for (const v of ['#0d1117', '#fff', '#0d1117cc', 'rgb(255 255 255 / 0.08)', 'rgba(0, 0, 0, 0.5)', 'oklch(0.62 0.19 259)', 'color-mix(in srgb, #fff 10%, transparent)', 'hsl(210 10% 20%)', 'transparent']) {
      expect(classifyToken(v), v).toBe('colour');
    }
  });

  it('tells lengths, times, easings and plain numbers apart', () => {
    expect(classifyToken('0.75rem')).toBe('length');
    expect(classifyToken('32px')).toBe('length');
    expect(classifyToken('110ms')).toBe('time');
    expect(classifyToken('0.18s')).toBe('time');
    expect(classifyToken('cubic-bezier(0.2, 0, 0.38, 0.9)')).toBe('easing');
    expect(classifyToken('ease-out')).toBe('easing');
    expect(classifyToken('450')).toBe('number');
    expect(classifyToken('1.25')).toBe('number');
  });

  it('recognises a shadow and a font stack', () => {
    expect(classifyToken('0 6px 16px -4px rgb(16 20 24 / 0.14), 0 2px 4px -2px rgb(16 20 24 / 0.08)')).toBe('shadow');
    expect(classifyToken("'Inter', ui-sans-serif, system-ui, sans-serif")).toBe('font');
    expect(classifyToken('"Archivo", "Helvetica Neue", sans-serif')).toBe('font');
  });

  it('calls an empty value unset, and anything else "other"', () => {
    expect(classifyToken('')).toBe('unset');
    expect(classifyToken('   ')).toBe('unset');
    expect(classifyToken('6 5')).toBe('other');
  });

  it('reads tokens through a getter, trimmed, in the order asked', () => {
    const css: Record<string, string> = { '--background': ' #0d1117 ', '--radius': '0.75rem', '--motion-fast': '110ms' };
    const get = (name: string) => css[name] ?? '';
    expect(readToken(get, '--background')).toEqual({ name: '--background', value: '#0d1117', kind: 'colour' });
    expect(readTokens(get, ['--radius', '--motion-fast', '--elevation-modal'])).toEqual([
      { name: '--radius', value: '0.75rem', kind: 'length' },
      { name: '--motion-fast', value: '110ms', kind: 'time' },
      { name: '--elevation-modal', value: '', kind: 'unset' },
    ]);
  });

  it('reads the custom properties an element resolves', () => {
    const el = document.createElement('div');
    el.style.setProperty('--series', '#5b8deb');
    el.style.setProperty('--radius-control', '4px');
    document.body.append(el);
    try {
      const [series, radius, missing] = readTokensOf(el, ['--series', '--radius-control', '--not-a-token']);
      expect(series).toEqual({ name: '--series', value: '#5b8deb', kind: 'colour' });
      expect(radius).toEqual({ name: '--radius-control', value: '4px', kind: 'length' });
      expect(missing!.kind).toBe('unset');
    } finally {
      el.remove();
    }
  });

  it('follows a change of theme: the same name, another value', () => {
    const el = document.createElement('div');
    document.body.append(el);
    try {
      el.style.setProperty('--background', '#0d1117');
      expect(readTokensOf(el, ['--background'])[0]!.value).toBe('#0d1117');
      el.style.setProperty('--background', '#fafafa');
      expect(readTokensOf(el, ['--background'])[0]!.value).toBe('#fafafa');
    } finally {
      el.remove();
    }
  });

  it('converts lengths to px and times to ms for drawing them to scale', () => {
    expect(toPx('0.25rem')).toBe(4);
    expect(toPx('12px')).toBe(12);
    expect(toPx('1.5rem', 10)).toBe(15);
    expect(toPx('50%')).toBeNull();
    expect(toPx('')).toBeNull();
    expect(toMs('110ms')).toBe(110);
    expect(toMs('0.28s')).toBe(280);
    expect(toMs('ease')).toBeNull();
  });

  it('cuts a long value for the table', () => {
    expect(shortValue('  #fff  ')).toBe('#fff');
    const long = '0 24px 48px -12px rgb(16 20 24 / 0.24), 0 8px 16px -8px rgb(16 20 24 / 0.12)';
    expect(shortValue(long, 30)).toHaveLength(30);
    expect(shortValue(long, 30).endsWith('…')).toBe(true);
  });
});
