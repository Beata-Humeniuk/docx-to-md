'use strict';

// Legacy binary .doc (Word 97–2003) is turned into .docx first, by a program
// that really reads it: Microsoft Word on Windows (driven through Windows
// Script Host, JScript) or LibreOffice anywhere. The .docx then goes through
// the same converter as any other.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

const TIMEOUT_MS = 180000;

// Word automation. A wrong "password" opens unprotected files normally and
// makes protected ones fail at once instead of waiting on a hidden dialog.
// Word is only quit when this script started it — an instance the user has
// documents open in stays as it was.
const WORD_SCRIPT = [
  'var src = WScript.Arguments(0), dst = WScript.Arguments(1);',
  'var word = null, doc = null, own = true, code = 0;',
  'try {',
  '  word = new ActiveXObject("Word.Application");',
  '  own = word.Documents.Count === 0;',
  '  word.DisplayAlerts = 0;',
  '  doc = word.Documents.Open(src, false, true, false, "\\u0001", "\\u0001");',
  '  try { doc.SaveAs2(dst, 12); } catch (e) { doc.SaveAs(dst, 12); }',
  '} catch (e) { WScript.StdErr.WriteLine(e.message || String(e)); code = 1; }',
  'try { if (doc) doc.Close(0); } catch (e) {}',
  'try { if (word && own) word.Quit(0); } catch (e) {}',
  'WScript.Quit(code);',
].join('\r\n');

function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
      const output = (String(stderr || '') + '\n' + String(stdout || '')).trim();
      if (err) {
        err.stderr = output;
        reject(err);
      } else resolve(output);
    });
  });
}

function libreOfficeCandidates(configured) {
  const out = [];
  if (configured) out.push(configured);
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files']) {
      if (base) out.push(path.join(base, 'LibreOffice', 'program', 'soffice.exe'));
    }
    out.push('soffice.exe');
  } else if (process.platform === 'darwin') {
    out.push('/Applications/LibreOffice.app/Contents/MacOS/soffice', 'soffice');
  } else {
    out.push('soffice', 'libreoffice');
  }
  return [...new Set(out)];
}

async function viaWord(src, dir) {
  const cscript = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cscript.exe');
  const script = path.join(dir, 'save-as-docx.js');
  const dst = path.join(dir, 'word-' + path.parse(src).name + '.docx');
  fs.writeFileSync(script, WORD_SCRIPT, 'utf8');
  await run(cscript, ['//Nologo', '//E:JScript', script, src, dst]);
  if (!fs.existsSync(dst)) throw new Error('Word did not write ' + dst);
  return dst;
}

async function viaLibreOffice(src, dir, exe) {
  const out = path.join(dir, 'lo');
  fs.mkdirSync(out, { recursive: true });
  // A private profile keeps this from colliding with a LibreOffice the user
  // has open (a second soffice would otherwise hand the job over and exit).
  const profile = pathToFileURL(path.join(dir, 'profile')).href;
  const output = await run(exe, ['-env:UserInstallation=' + profile, '--headless', '--norestore', '--nologo',
    '--convert-to', 'docx:MS Word 2007 XML', '--outdir', out, src]);
  const dst = path.join(out, path.parse(src).name + '.docx');
  // soffice exits with 0 even when it could not load the file.
  if (!fs.existsSync(dst)) throw new Error(output.split('\n').filter((l) => /error/i.test(l)).join(' ') || 'LibreOffice wrote no output');
  return dst;
}

// Returns the .docx bytes. Throws an error with code 'NO_DOC_CONVERTER' when
// neither Word nor LibreOffice could be started, and a plain error with the
// program's own reason when one started but could not read the file.
async function docToDocx(src, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-to-md-'));
  const attempts = [];
  let failure = null;
  try {
    if (process.platform === 'win32' && options.useWord !== false) {
      try {
        return fs.readFileSync(await viaWord(src, dir));
      } catch (e) {
        attempts.push('Word: ' + (e.stderr || e.message));
        if (e.code !== 'ENOENT') failure = failure || 'Word: ' + (e.stderr || e.message);
      }
    }
    for (const exe of libreOfficeCandidates(options.libreOfficePath)) {
      if (path.isAbsolute(exe) && !fs.existsSync(exe)) continue;
      try {
        return fs.readFileSync(await viaLibreOffice(src, dir, exe));
      } catch (e) {
        attempts.push('LibreOffice (' + exe + '): ' + (e.code === 'ENOENT' ? 'not found' : e.stderr || e.message));
        if (e.code !== 'ENOENT') { failure = failure || 'LibreOffice: ' + (e.stderr || e.message); break; }
      }
    }
    if (failure) throw new Error(failure);
    const err = new Error('no program to read .doc files: ' + attempts.join('; '));
    err.code = 'NO_DOC_CONVERTER';
    err.attempts = attempts;
    throw err;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { docToDocx, libreOfficeCandidates };
