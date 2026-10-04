'use strict';

const { openPackage } = require('./package');
const { readDocument } = require('./reader');

function readDocx(buffer, options) {
  return readDocument(openPackage(buffer), options);
}

module.exports = { readDocx };
