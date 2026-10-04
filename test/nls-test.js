'use strict';

// The message catalog contract: English is the base, Polish is a full
// translation of exactly the same keys, placeholders match, plural forms have
// the right arity per language, and unknown languages fall back to English.

const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } };

const { forLanguage, baseLanguage, EN, TRANSLATIONS } = require('../src/nls');

const PL = TRANSLATIONS.pl;
assert(PL, 'Polish translation present');

const enKeys = Object.keys(EN).sort();
const plKeys = Object.keys(PL).sort();
assert(JSON.stringify(enKeys) === JSON.stringify(plKeys),
  'Polish covers exactly the English key set; diff: ' +
  enKeys.filter((k) => !PL[k]).concat(plKeys.filter((k) => !EN[k])).join(', '));

const placeholders = (text) => (String(text).match(/\{\w+\}/g) || []).sort().join(',');
for (const key of enKeys) {
  const en = EN[key];
  const pl = PL[key];
  if (Array.isArray(en)) {
    assert(Array.isArray(pl), key + ': plural in both languages');
    assert(en.length === 2, key + ': English has [one, many]');
    assert(pl.length === 3, key + ': Polish has [one, few, many]');
  } else {
    assert(typeof en === 'string' && en !== '', key + ': English base is non-empty');
    assert(typeof pl === 'string' && pl !== '', key + ': Polish value is non-empty');
    assert(placeholders(en) === placeholders(pl),
      key + ': placeholders match (' + placeholders(en) + ' vs ' + placeholders(pl) + ')');
  }
}

assert(baseLanguage('pl-PL') === 'pl' && baseLanguage('en-US') === 'en' && baseLanguage('') === 'en',
  'language tag reduces to its base');

const en = forLanguage('en-US');
const pl = forLanguage('pl-PL');
const de = forLanguage('de');
assert(en.lang === 'en' && pl.lang === 'pl' && de.lang === 'en', 'unknown language falls back to English');
assert(pl.t('action.skip') === 'Pomiń' && en.t('action.skip') === 'Skip' && de.t('action.skip') === 'Skip', 'simple lookup');
assert(en.t('info.convertedOne', { file: 'a.md' }) === 'Saved a.md.', 'placeholder substitution');
assert(pl.t('info.convertedOne', { file: 'a.md' }) === 'Zapisano a.md.', 'Polish placeholder substitution');
assert(en.t('no.such.key') === 'no.such.key', 'unknown key returns the key');

assert(en.plural('plural.document', 1) === 'document' && en.plural('plural.document', 5) === 'documents', 'English plural');
assert(pl.plural('plural.document', 1) === 'dokument', 'Polish singular');
assert(pl.plural('plural.document', 3) === 'dokumenty', 'Polish few');
assert(pl.plural('plural.document', 5) === 'dokumentów', 'Polish many');
assert(pl.plural('plural.document', 12) === 'dokumentów', 'Polish teens go to many');
assert(pl.plural('plural.document', 22) === 'dokumenty', 'Polish 22 goes to few');

// The manifest is covered by the same rule: every %key% in package.json
// exists in the English base file, and the Polish file mirrors it.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const nlsEn = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.json'), 'utf8'));
const nlsPl = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.pl.json'), 'utf8'));
const used = new Set((manifest.match(/%[\w.]+%/g) || []).map((m) => m.slice(1, -1)));
assert(used.size > 0, 'manifest references nls keys');
for (const key of used) {
  assert(typeof nlsEn[key] === 'string' && nlsEn[key] !== '', 'package.nls.json defines ' + key);
  assert(typeof nlsPl[key] === 'string' && nlsPl[key] !== '', 'package.nls.pl.json defines ' + key);
}
assert(JSON.stringify(Object.keys(nlsEn).sort()) === JSON.stringify(Object.keys(nlsPl).sort()),
  'manifest nls files share one key set');

// Every message the extension asks for exists in the catalog.
const source = fs.readFileSync(path.join(root, 'src', 'extension.js'), 'utf8');
for (const m of source.matchAll(/nls\.(?:t|plural)\('([\w.]+)'/g)) assert(m[1] in EN, 'catalog defines ' + m[1]);

console.log('nls-test OK');
