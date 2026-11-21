import { type Box, type FabLayout, fabLift, isTypingTarget } from './fab-position';

/** A 390 × 844 phone with a 44px button, 16px from the right and the bottom. */
const phone = (obstacles: Box[]): FabLayout => ({ viewportHeight: 844, left: 290, right: 374, height: 44, base: 16, gap: 12, obstacles, max: 844 * 0.6 });
/** A 1440 × 900 desktop with a 40px button, 24px from the corner. */
const desktop = (obstacles: Box[]): FabLayout => ({ viewportHeight: 900, left: 1326, right: 1416, height: 40, base: 24, gap: 12, obstacles, max: 540 });

describe('Docs button position', () => {
  it('rests in the corner when nothing is there', () => {
    expect(fabLift(phone([]))).toBe(16);
    expect(fabLift(desktop([]))).toBe(24);
  });

  it('moves above the phone tab bar', () => {
    const tabBar: Box = { left: 0, right: 390, top: 780, bottom: 844 };
    expect(fabLift(phone([tabBar]))).toBe(844 - 780 + 12);
  });

  it('moves above a composer that sits above the tab bar', () => {
    const tabBar: Box = { left: 0, right: 390, top: 780, bottom: 844 };
    const composer: Box = { left: 12, right: 378, top: 690, bottom: 772 };
    expect(fabLift(phone([tabBar, composer]))).toBe(844 - 690 + 12);
    // The order the obstacles are found in does not matter.
    expect(fabLift(phone([composer, tabBar]))).toBe(844 - 690 + 12);
  });

  it('moves above a toast in the corner of a desktop', () => {
    const toast: Box = { left: 1060, right: 1416, top: 812, bottom: 876 };
    expect(fabLift(desktop([toast]))).toBe(900 - 812 + 12);
  });

  it('stays put for a composer that is not under it', () => {
    const centred: Box = { left: 340, right: 1100, top: 800, bottom: 880 };
    const hero: Box = { left: 300, right: 1416, top: 200, bottom: 280 };
    expect(fabLift(desktop([centred, hero]))).toBe(24);
  });

  it('keeps a gap: something that only comes close counts as in the way', () => {
    const near: Box = { left: 1000, right: 1320, top: 820, bottom: 890 };
    expect(fabLift(desktop([near]))).toBe(900 - 820 + 12);
    const clear: Box = { left: 1000, right: 1300, top: 820, bottom: 890 };
    expect(fabLift(desktop([clear]))).toBe(24);
  });

  it('ignores an element with no size', () => {
    expect(fabLift(desktop([{ left: 1300, right: 1300, top: 850, bottom: 850 }]))).toBe(24);
  });

  it('returns to the corner sooner than float in the middle of the screen', () => {
    const tall: Box = { left: 0, right: 1440, top: 100, bottom: 900 };
    expect(fabLift(desktop([tall]))).toBe(24);
  });
});

describe('the "?" shortcut', () => {
  const inBody = <T extends HTMLElement>(el: T): T => {
    document.body.append(el);
    return el;
  };
  afterEach(() => document.body.replaceChildren());

  it('is not taken while a person is typing', () => {
    expect(isTypingTarget(inBody(document.createElement('textarea')))).toBe(true);
    expect(isTypingTarget(inBody(document.createElement('input')))).toBe(true);
    expect(isTypingTarget(inBody(document.createElement('select')))).toBe(true);
    const box = inBody(document.createElement('div'));
    box.setAttribute('role', 'combobox');
    const inner = document.createElement('span');
    box.append(inner);
    expect(isTypingTarget(inner)).toBe(true);
    const editable = inBody(document.createElement('div'));
    editable.setAttribute('contenteditable', 'true');
    expect(isTypingTarget(editable)).toBe(true);
  });

  it('is taken anywhere else', () => {
    expect(isTypingTarget(inBody(document.createElement('button')))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document)).toBe(false);
  });
});
