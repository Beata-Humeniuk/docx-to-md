'use strict';

function placeCells(row) {
  let col = row.before;
  const cells = row.cells.map((cell) => {
    const placed = Object.assign({ col, rowspan: 1 }, cell);
    col += cell.span;
    return placed;
  });
  return { cells, header: row.header, width: col + row.after };
}

function spanRows(rows) {
  rows.forEach((row, r) => {
    for (const cell of row.cells.filter((c) => c.vMerge === 'restart')) {
      for (let k = r + 1; k < rows.length; k++) {
        const below = rows[k].cells.find((c) => c.col === cell.col);
        if (!below || below.vMerge !== 'continue') break;
        cell.rowspan++;
      }
    }
  });
}

function layoutTable(table) {
  const rows = table.rows.map(placeCells);
  spanRows(rows);
  return { rows, width: rows.reduce((max, r) => Math.max(max, r.width), 0) };
}

module.exports = { layoutTable };
