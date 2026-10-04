'use strict';

let failed = 0;

function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failed++;
    console.error('FAIL: ' + name + '\n  ' + String(e && e.message || e).split('\n').join('\n  '));
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error((what ? what + ': ' : '') + 'expected\n' + JSON.stringify(expected) + '\nbut got\n' + JSON.stringify(actual));
  }
}

function has(text, part, what) {
  if (!text.includes(part)) throw new Error((what ? what + ': ' : '') + 'missing ' + JSON.stringify(part) + ' in\n' + text);
}

function lacks(text, part, what) {
  if (text.includes(part)) throw new Error((what ? what + ': ' : '') + 'unexpected ' + JSON.stringify(part) + ' in\n' + text);
}

function done(label) {
  if (failed) {
    console.error(label + ': ' + failed + ' failed');
    process.exit(1);
  }
  console.log(label + ': ok');
}

module.exports = { check, eq, has, lacks, done };
