'use strict';

// List and heading numbering (numbering.xml) replayed in document order, so
// every numbered paragraph gets the label Word shows: "3.", "b)", "1.2.4",
// "§ 5", "IV." — including restarts, start overrides and legal numbering.

const { child, childrenNamed, attr, val } = require('./xml');

function roman(n) {
  if (n <= 0 || n >= 4000) return String(n);
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

// Word repeats the letter past z: a..z, aa..zz, aaa..
function letter(n) {
  if (n <= 0) return String(n);
  const ch = String.fromCharCode(97 + ((n - 1) % 26));
  return ch.repeat(Math.floor((n - 1) / 26) + 1);
}

function formatNumber(n, fmt) {
  switch (fmt) {
    case 'upperRoman': return roman(n);
    case 'lowerRoman': return roman(n).toLowerCase();
    case 'upperLetter': return letter(n).toUpperCase();
    case 'lowerLetter': return letter(n);
    case 'decimalZero': return n < 10 && n >= 0 ? '0' + n : String(n);
    case 'none': return '';
    default: return String(n);
  }
}

function readLevel(lvl) {
  const start = val(lvl, 'w:start');
  return {
    start: start === null ? 1 : Number(start),
    numFmt: val(lvl, 'w:numFmt') || 'decimal',
    lvlText: val(lvl, 'w:lvlText'),
    isLgl: !!child(lvl, 'w:isLgl'),
    restart: val(lvl, 'w:lvlRestart'),
    pStyle: val(lvl, 'w:pStyle'),
    indent: indentOf(child(lvl, 'w:pPr')),
  };
}

// Left indent in twips from a w:pPr (w:ind w:left, or w:start in newer files).
function indentOf(pPr) {
  const ind = child(pPr, 'w:ind');
  const v = attr(ind, 'w:left') !== null ? attr(ind, 'w:left') : attr(ind, 'w:start');
  return v === null ? null : Number(v);
}

function loadNumbering(root, styles) {
  const abstracts = new Map();
  const nums = new Map();
  if (root) {
    for (const a of childrenNamed(root, 'w:abstractNum')) {
      const levels = [];
      for (const lvl of childrenNamed(a, 'w:lvl')) levels[Number(attr(lvl, 'w:ilvl') || 0)] = readLevel(lvl);
      abstracts.set(attr(a, 'w:abstractNumId'), {
        levels,
        styleLink: val(a, 'w:numStyleLink'),
      });
    }
    for (const n of childrenNamed(root, 'w:num')) {
      const overrides = new Map();
      for (const o of childrenNamed(n, 'w:lvlOverride')) {
        const ilvl = Number(attr(o, 'w:ilvl') || 0);
        const so = val(o, 'w:startOverride');
        const lvl = child(o, 'w:lvl');
        overrides.set(ilvl, {
          start: so === null ? null : Number(so),
          level: lvl ? readLevel(lvl) : null,
        });
      }
      nums.set(attr(n, 'w:numId'), { abstractId: val(n, 'w:abstractNumId'), overrides });
    }
  }

  // An abstract definition that only points at a numbering style
  // (w:numStyleLink) takes its levels from the definition behind that style.
  function resolveAbstract(abstractId, depth = 0) {
    const a = abstracts.get(abstractId);
    if (!a) return null;
    if (a.styleLink && depth < 5 && styles) {
      const numId = styles.numberingStyleNumId(a.styleLink);
      const n = numId && nums.get(numId);
      if (n && n.abstractId !== abstractId) {
        const target = resolveAbstract(n.abstractId, depth + 1);
        if (target) return target;
      }
    }
    return { id: abstractId, levels: a.levels };
  }

  const states = new Map();
  const seenNums = new Set();

  function levelOf(numId, ilvl) {
    const n = nums.get(numId);
    if (!n) return null;
    const a = resolveAbstract(n.abstractId);
    if (!a) return null;
    const o = n.overrides.get(ilvl);
    return (o && o.level) || a.levels[ilvl] || null;
  }

  function levelForStyle(numId, styleId) {
    const n = nums.get(numId);
    const a = n && resolveAbstract(n.abstractId);
    if (!a || !styleId) return 0;
    const i = a.levels.findIndex((l) => l && l.pStyle === styleId);
    return i < 0 ? 0 : i;
  }

  // Advances the counter of (numId, ilvl) and returns the label Word shows.
  // kind: 'bullet', 'ordered' (a plain "N." / "N)" that Markdown can carry
  // as an ordered list), 'literal' (any other label, kept verbatim) or
  // 'none' (a numbered paragraph whose label is empty).
  function next(numId, ilvl) {
    if (!numId || numId === '0') return null;
    const n = nums.get(numId);
    if (!n) return null;
    const a = resolveAbstract(n.abstractId);
    if (!a) return null;
    // Counters are shared by every w:num over the same abstract definition —
    // that is how a list continues across interruptions — unless a w:num
    // restarts some level with a start override.
    let st = states.get(a.id);
    if (!st) { st = { counters: [], starts: [] }; states.set(a.id, st); }
    if (!seenNums.has(numId)) {
      seenNums.add(numId);
      for (const [lvl, o] of n.overrides) {
        if (o.start !== null || (o.level && o.level.start !== undefined)) {
          st.counters[lvl] = undefined;
          st.starts[lvl] = o.start !== null ? o.start : o.level.start;
          for (let d = lvl + 1; d < 9; d++) st.counters[d] = undefined;
        }
      }
    }
    const level = levelOf(numId, ilvl) || { start: 1, numFmt: 'decimal', lvlText: '%' + (ilvl + 1) + '.' };
    const startOf = (d) => {
      if (st.starts[d] !== undefined) return st.starts[d];
      const l = levelOf(numId, d);
      return l ? l.start : 1;
    };
    st.counters[ilvl] = st.counters[ilvl] === undefined ? startOf(ilvl) : st.counters[ilvl] + 1;
    for (let d = ilvl + 1; d < 9; d++) {
      const l = levelOf(numId, d);
      // w:lvlRestart="0" means the level never restarts; otherwise it
      // restarts when a level above (by default any) advances.
      if (l && l.restart === '0') continue;
      if (l && l.restart !== null && l.restart !== undefined && Number(l.restart) - 1 < ilvl) continue;
      st.counters[d] = undefined;
      st.starts[d] = undefined;
    }

    const indent = level.indent;
    if (level.numFmt === 'bullet') return { kind: 'bullet', label: '', ilvl, indent };
    const text = level.lvlText === null || level.lvlText === undefined ? '%' + (ilvl + 1) + '.' : level.lvlText;
    const label = text.replace(/%([1-9])/g, (whole, digit) => {
      const d = Number(digit) - 1;
      const l = levelOf(numId, d) || { numFmt: 'decimal' };
      const value = st.counters[d] === undefined ? startOf(d) : st.counters[d];
      const fmt = level.isLgl && d < ilvl && l.numFmt !== 'none' ? 'decimal' : l.numFmt;
      return formatNumber(value, fmt === 'bullet' ? 'decimal' : fmt);
    }).trim();
    if (!label) return { kind: 'none', label: '', ilvl, indent };
    const ordered = /^\d{1,9}[.)]$/.test(label);
    return { kind: ordered ? 'ordered' : 'literal', label, ilvl, indent };
  }

  return { next, levelForStyle };
}

module.exports = { loadNumbering, formatNumber, indentOf };
