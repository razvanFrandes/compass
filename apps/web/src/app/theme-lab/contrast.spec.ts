import { apcaLc, passes, toHex, wcagRatio } from './contrast';

describe('theme lab contrast maths', () => {
  it('computes the WCAG 2 ratio', () => {
    expect(wcagRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(wcagRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    // #767676 is the lightest grey that passes AA on white; #777777 just misses.
    expect(wcagRatio([0x76, 0x76, 0x76], [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(wcagRatio([0x77, 0x77, 0x77], [255, 255, 255])).toBeLessThan(4.5);
  });

  it('does not round a near miss up to a pass', () => {
    expect(passes(4.499, 'text')).toBe(false);
    expect(passes(4.5, 'text')).toBe(true);
    expect(passes(3.2, 'graphic')).toBe(true);
    expect(passes(2.999, 'graphic')).toBe(false);
  });

  it('matches the APCA reference values', () => {
    // Checked against the apca-w3 reference implementation: text colour, background colour, expected Lc.
    expect(apcaLc([0x88, 0x88, 0x88], [0xff, 0xff, 0xff])).toBeCloseTo(63.056469930209, 4);
    expect(apcaLc([0xff, 0xff, 0xff], [0x88, 0x88, 0x88])).toBeCloseTo(-68.541464366275, 4);
    expect(apcaLc([0x00, 0x00, 0x00], [0xaa, 0xaa, 0xaa])).toBeCloseTo(58.146262578561, 4);
    expect(apcaLc([0xaa, 0xaa, 0xaa], [0x00, 0x00, 0x00])).toBeCloseTo(-56.241133742364, 4);
    expect(apcaLc([0x11, 0x22, 0x33], [0xdd, 0xee, 0xff])).toBeCloseTo(91.66830811481, 4);
    expect(apcaLc([0xdd, 0xee, 0xff], [0x11, 0x22, 0x33])).toBeCloseTo(-93.06770049484, 4);
  });

  it('reports no contrast for near-identical colours', () => {
    expect(apcaLc([0x11, 0x22, 0x33], [0x11, 0x22, 0x33])).toBe(0);
  });

  it('formats a colour as hex', () => {
    expect(toHex([16, 20, 24])).toBe('#101418');
  });
});
