'use strict';

const fs = require('fs');
const path = require('path');
const { run } = require('./run');

const WD_FORMAT_DOCX = 12;
const NO_PASSWORD = '\\u0001';

const SCRIPT = `
var src = WScript.Arguments(0), dst = WScript.Arguments(1);
var word = null, doc = null, ownInstance = true, code = 0;
try {
  word = new ActiveXObject("Word.Application");
  ownInstance = word.Documents.Count === 0;
  word.DisplayAlerts = 0;
  doc = word.Documents.Open(src, false, true, false, "${NO_PASSWORD}", "${NO_PASSWORD}");
  try { doc.SaveAs2(dst, ${WD_FORMAT_DOCX}); } catch (e) { doc.SaveAs(dst, ${WD_FORMAT_DOCX}); }
} catch (e) { WScript.StdErr.WriteLine(e.message || String(e)); code = 1; }
try { if (doc) doc.Close(0); } catch (e) {}
try { if (word && ownInstance) word.Quit(0); } catch (e) {}
WScript.Quit(code);
`;

async function convertWithWord(src, dir) {
  const cscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cscript.exe');
  const script = path.join(dir, 'save-as-docx.js');
  const dst = path.join(dir, 'word-' + path.parse(src).name + '.docx');
  fs.writeFileSync(script, SCRIPT.trim().replace(/\n/g, '\r\n'), 'utf8');
  await run(cscript, ['//Nologo', '//E:JScript', script, src, dst]);
  if (!fs.existsSync(dst)) throw new Error('Word did not write ' + dst);
  return dst;
}

module.exports = { convertWithWord };
