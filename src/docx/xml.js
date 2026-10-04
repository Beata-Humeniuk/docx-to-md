'use strict';

const PREFIXES = require('./namespaces');

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const ATTRIBUTE = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function decode(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (whole, e) => {
    if (e[0] !== '#') return ENTITIES[e] || whole;
    const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
  });
}

function qualify(qname, scope, isAttribute) {
  const colon = qname.indexOf(':');
  if (colon < 0) {
    const prefix = !isAttribute && PREFIXES[scope['']];
    return prefix ? prefix + ':' + qname : qname;
  }
  const prefix = qname.slice(0, colon);
  if (prefix === 'xmlns') return qname;
  return (PREFIXES[scope[prefix]] || prefix) + ':' + qname.slice(colon + 1);
}

function tagEnd(text, from) {
  let quote = null;
  for (let j = from; j < text.length; j++) {
    const ch = text[j];
    if (quote) { if (ch === quote) quote = null; } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return j;
  }
  return text.length;
}

function openTag(body, parentScope) {
  const name = /^[^\s/>]+/.exec(body)[0];
  const scope = Object.create(parentScope);
  const raw = [];
  ATTRIBUTE.lastIndex = name.length;
  for (let a; (a = ATTRIBUTE.exec(body));) {
    const value = decode(a[3] !== undefined ? a[3] : a[4]);
    if (a[1] === 'xmlns') scope[''] = value;
    else if (a[1].startsWith('xmlns:')) scope[a[1].slice(6)] = value;
    raw.push([a[1], value]);
  }
  const attrs = {};
  for (const [k, v] of raw) attrs[qualify(k, scope, true)] = v;
  return { node: { name: qualify(name, scope, false), attrs, children: [] }, scope };
}

function skipTo(text, marker, from) {
  const end = text.indexOf(marker, from);
  return end < 0 ? text.length : end + marker.length;
}

function parseXml(text) {
  if (Buffer.isBuffer(text)) text = text.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const root = { name: '#document', attrs: {}, children: [] };
  const stack = [{ node: root, scope: {} }];
  let i = 0;
  while (i < text.length) {
    const top = stack[stack.length - 1];
    const lt = text.indexOf('<', i);
    const textEnd = lt < 0 ? text.length : lt;
    if (textEnd > i) top.node.children.push(decode(text.slice(i, textEnd)));
    if (lt < 0) break;
    if (text.startsWith('<!--', lt)) {
      i = skipTo(text, '-->', lt + 4);
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      top.node.children.push(text.slice(lt + 9, end < 0 ? text.length : end));
      i = end < 0 ? text.length : end + 3;
    } else if (text[lt + 1] === '?' || text[lt + 1] === '!' || text[lt + 1] === '/') {
      if (text[lt + 1] === '/' && stack.length > 1) stack.pop();
      i = skipTo(text, '>', lt);
    } else {
      const end = tagEnd(text, lt + 1);
      const body = text.slice(lt + 1, end);
      const selfClosing = body.endsWith('/');
      const tag = openTag(selfClosing ? body.slice(0, -1) : body, top.scope);
      top.node.children.push(tag.node);
      if (!selfClosing) stack.push(tag);
      i = end + 1;
    }
  }
  return root.children.find((c) => typeof c !== 'string') || null;
}

function elements(node) {
  return node ? node.children.filter((c) => typeof c !== 'string') : [];
}

function child(node, name) {
  return (node && node.children.find((c) => typeof c !== 'string' && c.name === name)) || null;
}

function childrenNamed(node, name) {
  return elements(node).filter((c) => c.name === name);
}

function attr(node, name) {
  return node && node.attrs[name] !== undefined ? node.attrs[name] : null;
}

function val(node, name) {
  return attr(child(node, name), 'w:val');
}

function textOf(node) {
  if (!node) return '';
  return node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}

function descendants(node, name, out = []) {
  for (const c of elements(node)) {
    if (c.name === name) out.push(c);
    descendants(c, name, out);
  }
  return out;
}

module.exports = { parseXml, elements, child, childrenNamed, attr, val, textOf, descendants };
