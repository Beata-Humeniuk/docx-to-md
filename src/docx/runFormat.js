'use strict';

const { child, attr, val } = require('./xml');

const MONOSPACE = /courier|consolas|mono|menlo|monaco|lucida console|lucida sans typewriter|source code|fira code|inconsolata|fixedsys/i;
const FORMAT_KEYS = ['b', 'i', 's', 'u', 'sup', 'sub', 'mark', 'code', 'ins', 'del'];

function toggle(node) {
  if (!node) return undefined;
  return !['0', 'false', 'off', 'none'].includes(attr(node, 'w:val'));
}

function applyRunProps(fmt, rPr) {
  if (!rPr) return fmt;
  const set = (key, v) => { if (v !== undefined) fmt[key] = v; };
  set('b', toggle(child(rPr, 'w:b')));
  set('i', toggle(child(rPr, 'w:i')));
  set('vanish', toggle(child(rPr, 'w:vanish')));
  const strike = toggle(child(rPr, 'w:strike'));
  const dstrike = toggle(child(rPr, 'w:dstrike'));
  if (strike !== undefined || dstrike !== undefined) fmt.s = !!(strike || dstrike);
  const u = child(rPr, 'w:u');
  if (u) fmt.u = attr(u, 'w:val') !== 'none';
  const align = val(rPr, 'w:vertAlign');
  if (align) {
    fmt.sup = align === 'superscript';
    fmt.sub = align === 'subscript';
  }
  const highlight = val(rPr, 'w:highlight');
  if (highlight) fmt.mark = highlight !== 'none';
  const fonts = child(rPr, 'w:rFonts');
  const face = fonts && (attr(fonts, 'w:ascii') || attr(fonts, 'w:hAnsi') || attr(fonts, 'w:cs'));
  if (face) fmt.code = MONOSPACE.test(face);
  return fmt;
}

function cleanFormat(fmt) {
  const out = {};
  for (const k of FORMAT_KEYS) if (fmt[k]) out[k] = true;
  return out;
}

function sameFormat(a, b) {
  return FORMAT_KEYS.every((k) => !!a[k] === !!b[k]);
}

module.exports = { toggle, applyRunProps, cleanFormat, sameFormat };
