'use strict';

const isWordChar = (ch) => /[\p{L}\p{N}]/u.test(ch || '');

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeText(s, inTable) {
  const out = s
    .replace(/[\\`*[\]~]/g, '\\$&')
    .replace(/<(?=[A-Za-z/!?])/g, '\\<')
    .replace(/&(?=#?[A-Za-z0-9]+;)/g, '\\&')
    .replace(/_/g, (m, i, str) => (isWordChar(str[i - 1]) && isWordChar(str[i + 1]) ? m : '\\_'));
  return inTable ? out.replace(/\|/g, '\\|') : out;
}

function escapeLineStart(line) {
  return line
    .replace(/^(#{1,6})(?=\s|$)/, '\\$1')
    .replace(/^>/, '\\>')
    .replace(/^([-+])(?=\s|$)/, '\\$1')
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^(=+|-+)\s*$/, '\\$1');
}

function longestRun(text, re) {
  return (text.match(re) || []).reduce((max, run) => Math.max(max, run.length), 0);
}

function codeSpan(text) {
  const fence = '`'.repeat(longestRun(text, /`+/g) + 1);
  const pad = /^`|`$/.test(text) || /^ .* $/.test(text) ? ' ' : '';
  return fence + pad + text + pad + fence;
}

function codeBlock(body) {
  const fence = '`'.repeat(Math.max(2, longestRun(body, /^`{3,}/gm)) + 1);
  return fence + '\n' + body + '\n' + fence;
}

function linkDestination(url) {
  if (!/[\s()<>]/.test(url)) return url;
  return '<' + url.replace(/[<>]/g, (c) => encodeURIComponent(c)) + '>';
}

function normalizeSpaces(s) {
  return s.replace(/[\t  ]+/g, ' ').trim();
}

function slugify(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
}

function flatText(nodes, lineBreak) {
  return nodes.map((n) => {
    if (n.t === 'text') return n.text;
    if (n.t === 'break') return lineBreak;
    return n.t === 'link' ? flatText(n.children, lineBreak) : '';
  }).join('');
}

const plainText = (nodes) => flatText(nodes, ' ');
const codeText = (nodes) => flatText(nodes, '\n');

function splitEdges(text) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  return { lead: m[1], core: m[2], trail: m[3] };
}

module.exports = {
  escapeHtml, escapeText, escapeLineStart, codeSpan, codeBlock, linkDestination,
  normalizeSpaces, slugify, plainText, codeText, splitEdges,
};
