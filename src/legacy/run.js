'use strict';

const { execFile } = require('child_process');

const TIMEOUT_MS = 180000;

function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
      const output = (String(stderr || '') + '\n' + String(stdout || '')).trim();
      if (err) reject(Object.assign(err, { stderr: output }));
      else resolve(output);
    });
  });
}

module.exports = { run };
