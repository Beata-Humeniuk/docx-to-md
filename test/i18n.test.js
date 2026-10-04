'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { forLanguage, baseLanguage, EN, TRANSLATIONS } = require('../src/i18n');

const ROOT = path.join(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const placeholders = (text) => (String(text).match(/\{\w+\}/g) || []).sort().join(',');

test('Polish covers every English message with the same placeholders', () => {
  const pl = TRANSLATIONS.pl;
  assert.deepEqual(Object.keys(pl).sort(), Object.keys(EN).sort());
  for (const key of Object.keys(EN)) {
    if (Array.isArray(EN[key])) {
      assert.equal(EN[key].length, 2, key);
      assert.equal(pl[key].length, 3, key);
    } else {
      assert.ok(EN[key] && pl[key], key);
      assert.equal(placeholders(pl[key]), placeholders(EN[key]), key);
    }
  }
});

test('lookup, placeholders and fallback', () => {
  const en = forLanguage('en-US');
  const pl = forLanguage('pl-PL');
  assert.equal(baseLanguage('pl-PL'), 'pl');
  assert.equal(forLanguage('de').lang, 'en');
  assert.equal(pl.t('action.skip'), 'Pomiń');
  assert.equal(forLanguage('de').t('action.skip'), 'Skip');
  assert.equal(en.t('info.convertedOne', { file: 'a.md' }), 'Saved a.md.');
  assert.equal(en.t('no.such.key'), 'no.such.key');
});

test('plural forms', () => {
  const en = forLanguage('en');
  const pl = forLanguage('pl');
  assert.deepEqual([1, 5].map((n) => en.plural('plural.document', n)), ['document', 'documents']);
  assert.deepEqual([1, 3, 5, 12, 22].map((n) => pl.plural('plural.document', n)),
    ['dokument', 'dokumenty', 'dokumentów', 'dokumentów', 'dokumenty']);
});

test('manifest strings exist in both languages', () => {
  const manifest = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const en = readJson('package.nls.json');
  const pl = readJson('package.nls.pl.json');
  for (const [, key] of manifest.matchAll(/%([\w.]+)%/g)) assert.ok(en[key] && pl[key], key);
  assert.deepEqual(Object.keys(pl).sort(), Object.keys(en).sort());
});

test('every message used in code exists', () => {
  const sources = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n');
  for (const [, key] of sources.matchAll(/nls\.(?:t|plural)\('([\w.]+)'/g)) assert.ok(key in EN, key);
  for (const [, key] of sources.matchAll(/'(plural\.\w+)'/g)) assert.ok(key in EN, key);
});
