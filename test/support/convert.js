'use strict';

const { docx, STYLES } = require('./docx');
const { convertDocx } = require('../../src');

function md(body, parts = {}, options = {}) {
  return convertDocx(docx(Object.assign({ body, styles: STYLES }, parts)), options).markdown;
}

module.exports = { md };
