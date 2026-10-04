'use strict';

const EN = require('./en');
const TRANSLATIONS = { pl: require('./pl') };

const PLURAL_RULES = {
  en: (n) => (n === 1 ? 0 : 1),
  pl: (n) => {
    if (n === 1) return 0;
    const units = n % 10;
    const tens = n % 100;
    return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? 1 : 2;
  },
};

function baseLanguage(tag) {
  return String(tag || 'en').toLowerCase().split(/[-_]/)[0];
}

function forLanguage(tag) {
  const lang = baseLanguage(tag);
  const table = TRANSLATIONS[lang] || {};
  const rule = PLURAL_RULES[lang] || PLURAL_RULES.en;
  const lookup = (key) => {
    const value = table[key];
    const present = Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value !== '';
    return present ? value : EN[key];
  };

  const t = (key, params = {}) => {
    const text = lookup(key);
    if (typeof text !== 'string') return key;
    return text.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
  };

  const plural = (key, n) => {
    const forms = lookup(key);
    if (!Array.isArray(forms) || !forms.length) return typeof forms === 'string' ? forms : key;
    return forms[Math.min(rule(n), forms.length - 1)];
  };

  return { lang: PLURAL_RULES[lang] ? lang : 'en', t, plural };
}

module.exports = { forLanguage, baseLanguage, EN, TRANSLATIONS };
