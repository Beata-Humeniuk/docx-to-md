'use strict';

const { child, attr } = require('./xml');

function indentOf(pPr) {
  const ind = child(pPr, 'w:ind');
  const v = attr(ind, 'w:left') !== null ? attr(ind, 'w:left') : attr(ind, 'w:start');
  return v === null ? null : Number(v);
}

module.exports = { indentOf };
