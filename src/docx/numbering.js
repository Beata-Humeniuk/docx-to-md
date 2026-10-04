'use strict';

const { child, childrenNamed, attr, val } = require('./xml');
const { indentOf } = require('./indent');
const { formatNumber } = require('./numberFormat');

const LEVELS = 9;

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

function readDefinitions(root) {
  const abstracts = new Map();
  const nums = new Map();
  for (const a of childrenNamed(root, 'w:abstractNum')) {
    const levels = [];
    for (const lvl of childrenNamed(a, 'w:lvl')) levels[Number(attr(lvl, 'w:ilvl') || 0)] = readLevel(lvl);
    abstracts.set(attr(a, 'w:abstractNumId'), { levels, styleLink: val(a, 'w:numStyleLink') });
  }
  for (const n of childrenNamed(root, 'w:num')) {
    const overrides = new Map();
    for (const o of childrenNamed(n, 'w:lvlOverride')) {
      const start = val(o, 'w:startOverride');
      const lvl = child(o, 'w:lvl');
      overrides.set(Number(attr(o, 'w:ilvl') || 0), {
        start: start === null ? null : Number(start),
        level: lvl ? readLevel(lvl) : null,
      });
    }
    nums.set(attr(n, 'w:numId'), { abstractId: val(n, 'w:abstractNumId'), overrides });
  }
  return { abstracts, nums };
}

function restartsWith(level, ilvl) {
  if (!level || level.restart === null || level.restart === undefined) return true;
  return level.restart !== '0' && Number(level.restart) - 1 >= ilvl;
}

function kindOf(label) {
  if (!label) return 'none';
  return /^\d{1,9}[.)]$/.test(label) ? 'ordered' : 'literal';
}

function loadNumbering(root, styles) {
  const { abstracts, nums } = readDefinitions(root);
  const states = new Map();
  const seenNums = new Set();

  function resolveAbstract(abstractId, depth = 0) {
    const a = abstracts.get(abstractId);
    if (!a) return null;
    if (a.styleLink && depth < 5 && styles) {
      const n = nums.get(styles.numberingStyleNumId(a.styleLink));
      const target = n && n.abstractId !== abstractId && resolveAbstract(n.abstractId, depth + 1);
      if (target) return target;
    }
    return { id: abstractId, levels: a.levels };
  }

  function levelOf(numId, ilvl) {
    const n = nums.get(numId);
    const a = n && resolveAbstract(n.abstractId);
    if (!a) return null;
    const o = n.overrides.get(ilvl);
    return (o && o.level) || a.levels[ilvl] || null;
  }

  function levelForStyle(numId, styleId) {
    const n = nums.get(numId);
    const a = n && resolveAbstract(n.abstractId);
    if (!a || !styleId) return 0;
    return Math.max(0, a.levels.findIndex((l) => l && l.pStyle === styleId));
  }

  function stateFor(numId, n, abstractId) {
    if (!states.has(abstractId)) states.set(abstractId, { counters: [], starts: [] });
    const st = states.get(abstractId);
    if (seenNums.has(numId)) return st;
    seenNums.add(numId);
    for (const [lvl, o] of n.overrides) {
      const start = o.start !== null ? o.start : o.level ? o.level.start : undefined;
      if (start === undefined) continue;
      st.starts[lvl] = start;
      for (let d = lvl; d < LEVELS; d++) st.counters[d] = undefined;
    }
    return st;
  }

  function next(numId, ilvl) {
    const n = numId && numId !== '0' && nums.get(numId);
    const a = n && resolveAbstract(n.abstractId);
    if (!a) return null;
    const st = stateFor(numId, n, a.id);
    const startOf = (d) => (st.starts[d] !== undefined ? st.starts[d] : (levelOf(numId, d) || { start: 1 }).start);
    const valueOf = (d) => (st.counters[d] === undefined ? startOf(d) : st.counters[d]);

    st.counters[ilvl] = st.counters[ilvl] === undefined ? startOf(ilvl) : st.counters[ilvl] + 1;
    for (let d = ilvl + 1; d < LEVELS; d++) {
      if (!restartsWith(levelOf(numId, d), ilvl)) continue;
      st.counters[d] = undefined;
      st.starts[d] = undefined;
    }

    const level = levelOf(numId, ilvl) || { numFmt: 'decimal', lvlText: null, indent: undefined };
    if (level.numFmt === 'bullet') return { kind: 'bullet', label: '', ilvl, indent: level.indent };
    const pattern = level.lvlText === null || level.lvlText === undefined ? '%' + (ilvl + 1) + '.' : level.lvlText;
    const label = pattern.replace(/%([1-9])/g, (whole, digit) => {
      const d = Number(digit) - 1;
      const fmt = (levelOf(numId, d) || { numFmt: 'decimal' }).numFmt;
      const legal = level.isLgl && d < ilvl && fmt !== 'none';
      return formatNumber(valueOf(d), legal || fmt === 'bullet' ? 'decimal' : fmt);
    }).trim();
    return { kind: kindOf(label), label, ilvl, indent: level.indent };
  }

  return { next, levelForStyle };
}

module.exports = { loadNumbering };
