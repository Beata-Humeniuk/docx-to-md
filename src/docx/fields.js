'use strict';

const PAGE_FIELDS = ['PAGEREF', 'PAGE', 'NUMPAGES', 'SECTIONPAGES'];
const CAPTION_SWITCHES = ['\\c', '\\a', '\\f'];

function fieldArgs(instruction) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  for (let m; (m = re.exec(instruction));) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

const isSwitch = (arg) => arg.startsWith('\\');

function switchValue(args, name) {
  const i = args.findIndex((a) => a.toLowerCase() === name);
  if (i < 0) return null;
  const next = args[i + 1];
  return next !== undefined && !isSwitch(next) ? next : '';
}

function tableOfContents(args) {
  if (CAPTION_SWITCHES.some((s) => switchValue(args, s) !== null)) return { kind: 'plain' };
  const range = /^(\d)\s*-\s*(\d)$/.exec((switchValue(args, '\\o') || '').trim());
  return { kind: 'toc', from: range ? Number(range[1]) : 1, to: range ? Number(range[2]) : 9 };
}

function analyzeField(instruction) {
  const args = fieldArgs(instruction.trim());
  const head = (args[0] || '').toUpperCase();
  const target = args[1] !== undefined && !isSwitch(args[1]) ? args[1] : null;
  if (head === 'TOC') return tableOfContents(args);
  if (head === 'REF') return target ? { kind: 'link', anchor: target } : { kind: 'plain' };
  if (PAGE_FIELDS.includes(head)) return { kind: 'suppress' };
  if (head !== 'HYPERLINK') return { kind: 'plain' };
  const anchor = switchValue(args, '\\l');
  if (target) return { kind: 'link', href: target, anchor: anchor || null };
  return anchor ? { kind: 'link', anchor } : { kind: 'plain' };
}

module.exports = { analyzeField };
