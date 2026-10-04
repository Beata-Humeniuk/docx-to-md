'use strict';

const SYMBOLS = {
  0xf0b7: '•', 0xf0a7: '▪', 0xf06e: '■', 0xf071: '❑', 0xf076: '❖', 0xf0d8: '➢',
  0xf0fc: '✓', 0xf0fb: '✗', 0xf0fe: '☑', 0xf0a8: '◆', 0xf0e0: '→', 0xf0e8: '➔', 0xf0f0: '⇨',
  0xf06c: '●', 0xf0a1: '○', 0xf0b0: '°', 0xf0b1: '±', 0xf0b4: '×', 0xf0b8: '÷', 0xf0ae: '→',
};

const isPrivateUse = (code) => code >= 0xe000 && code <= 0xf8ff;

function symbolText(hex) {
  const code = parseInt(hex || '', 16);
  if (!Number.isFinite(code)) return null;
  return SYMBOLS[code] || SYMBOLS[code | 0xf000] || (isPrivateUse(code) ? '' : String.fromCodePoint(code));
}

module.exports = { symbolText };
