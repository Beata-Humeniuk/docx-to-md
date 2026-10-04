'use strict';

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function roman(n) {
  if (n <= 0 || n >= 4000) return String(n);
  let out = '';
  for (const [value, digits] of ROMAN) while (n >= value) { out += digits; n -= value; }
  return out;
}

function letter(n) {
  if (n <= 0) return String(n);
  return String.fromCharCode(97 + ((n - 1) % 26)).repeat(Math.floor((n - 1) / 26) + 1);
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

module.exports = { formatNumber };
