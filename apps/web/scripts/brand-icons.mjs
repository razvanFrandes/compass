// The icon files of the Compass brand, generated from the glyph the logo component draws
// (src/app/shell/compass-logo.ts): Phosphor's compass, Fill weight, in white on a rounded violet tile.
//
//   node scripts/brand-icons.mjs        (from apps/web; needs Chrome, or CHROME=/path/to/chrome)
//
// It writes, in public/:
//   favicon.svg            the tile; lighter violet when the browser's chrome is dark (prefers-color-scheme)
//   favicon-32.png         32 px, transparent corners, in one violet that holds on light and dark tab strips
//   favicon.ico            16, 32 and 48 px of the same, for browsers that ask for /favicon.ico
//   apple-touch-icon.png   180 px, square and opaque: iOS rounds the corners itself
//
// The PNGs are drawn by Chrome on a canvas at the exact size, so nothing here needs an image library.
// og.png is a screenshot of the Inbox (1200×630, dark theme), taken by hand after a visual change.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { phosphorCompassFill } from '@ng-icons/phosphor-icons/fill';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));

// The tile is --primary of the light theme, and Juyo's purple #996AD5 where the browser's chrome is dark; the glyph
// is white. White on the tile: 5.8:1 and 3.9:1. The tile on a tab strip: 5.8:1 on white, 3.1:1 on Chrome's dark tab
// (#35363a). A PNG cannot follow the colour scheme, so the small ones take the violet between the two, which keeps
// 3:1 everywhere: 4.0:1 under the glyph and on white, 3.05:1 on a light strip (#dee1e6), 3.02:1 on the dark tab.
const TILE = '#7a4dc0';
const TILE_ON_DARK = '#996ad5';
const TILE_ANY = '#9768d4';
const INK = '#ffffff';
/** The corner radius and the glyph's size, as shares of the tile: the same as the component's. */
const RADIUS = 0.25;
const GLYPH = 0.75;

const path = /\sd="([^"]+)"/.exec(phosphorCompassFill)?.[1];
if (!path) throw new Error('The Phosphor compass has no path: did @ng-icons/phosphor-icons change its format?');

/** The mark on a 32 px grid. `square` is the full-bleed tile for iOS; `adaptive` adds the dark-chrome colour. */
function mark({ square = false, adaptive = false, fill = TILE } = {}) {
  const inset = (32 * (1 - GLYPH)) / 2;
  const style = adaptive ? `<style>.t{fill:${TILE}}@media (prefers-color-scheme:dark){.t{fill:${TILE_ON_DARK}}}</style>` : '';
  const tile = `<rect ${adaptive ? 'class="t"' : `fill="${fill}"`} width="32" height="32"${square ? '' : ` rx="${32 * RADIUS}"`}/>`;
  const glyph = `<path fill="${INK}" transform="translate(${inset} ${inset}) scale(${(32 * GLYPH) / 256})" d="${path}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${style}${tile}${glyph}</svg>`;
}

function chrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error('Chrome not found. Set CHROME to its path.');
  return found;
}

/** Draws each SVG at its size on a canvas in headless Chrome and returns the PNGs. */
function rasterize(jobs) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-icons-'));
  try {
    const page = join(dir, 'page.html');
    const images = jobs.map(({ svg }) => `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`).join('');
    const script = `
      addEventListener('load', () => {
        const sizes = ${JSON.stringify(jobs.map((job) => job.size))};
        const out = [...document.images].map((img, i) => {
          const canvas = Object.assign(document.createElement('canvas'), { width: sizes[i], height: sizes[i] });
          canvas.getContext('2d').drawImage(img, 0, 0, sizes[i], sizes[i]);
          return canvas.toDataURL('image/png');
        });
        document.body.innerHTML = '<pre id="out">' + out.join('\\n') + '</pre>';
      });`;
    writeFileSync(page, `<!doctype html><meta charset="utf-8"><body>${images}<script>${script}</script>`);
    const dom = execFileSync(chrome(), ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(dir, 'profile')}`, '--virtual-time-budget=2000', '--dump-dom', pathToFileURL(page).href], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const urls = /<pre id="out">([^<]*)<\/pre>/.exec(dom)?.[1].split('\n') ?? [];
    if (urls.length !== jobs.length) throw new Error('Chrome did not return the icons.');
    return urls.map((url) => Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** An .ico file that holds PNGs as they are (every current browser reads these). */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const directory = entries.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...directory, ...entries.map((entry) => entry.png)]);
}

const [png16, png32, png48, png180] = rasterize([
  { svg: mark({ fill: TILE_ANY }), size: 16 },
  { svg: mark({ fill: TILE_ANY }), size: 32 },
  { svg: mark({ fill: TILE_ANY }), size: 48 },
  { svg: mark({ square: true }), size: 180 },
]);

writeFileSync(join(OUT, 'favicon.svg'), mark({ adaptive: true }) + '\n');
writeFileSync(join(OUT, 'favicon-32.png'), png32);
writeFileSync(join(OUT, 'favicon.ico'), ico([{ size: 16, png: png16 }, { size: 32, png: png32 }, { size: 48, png: png48 }]));
writeFileSync(join(OUT, 'apple-touch-icon.png'), png180);
console.log('Wrote favicon.svg, favicon-32.png, favicon.ico and apple-touch-icon.png to public/.');
