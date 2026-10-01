// The offline cache must list every file the game loads, or it breaks without a connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every source module, the bundled three.js, the sounds and every icon are precached, and every precached file exists', () => {
  for (const f of readdirSync(new URL('../src', import.meta.url))) if (f.endsWith('.mjs')) assert.ok(assets.includes(`src/${f}`), `src/${f} missing from sw.js`);
  for (const f of readdirSync(new URL('../src/vendor', import.meta.url))) if (f.endsWith('.js')) assert.ok(assets.includes(`src/vendor/${f}`), `src/vendor/${f} missing from sw.js`);
  for (const f of readdirSync(new URL('../assets/sfx', import.meta.url))) if (f.endsWith('.mp3')) assert.ok(assets.includes(`assets/sfx/${f}`), `assets/sfx/${f} missing from sw.js`);
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  for (const i of manifest.icons) assert.ok(assets.includes(i.src), `${i.src} missing from sw.js`);
  for (const a of assets.filter((x) => x !== './')) assert.ok(existsSync(new URL(`../${a}`, import.meta.url)), `${a} does not exist`);
});
