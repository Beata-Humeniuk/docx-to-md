'use strict';

module.exports = {
  HEADING_NAME: /^(heading|nagłówek|naglowek|überschrift|titre|encabezado|título|titolo|kop)\s*([1-9])$/i,
  HEADING_ID: /^(heading|nag[łl]?[oó]?wek|berschrift|titre|encabezado|kop)([1-9])$/i,
  TOC_ENTRY_NAME: /^(toc|spis treści|spis tresci|verzeichnis|tdm|tabla de contenido)\s*([1-9])$/i,
  TOC_ENTRY_ID: /^(toc|spistreci|spistresci|verzeichnis)([1-9])$/i,
  TOC_HEADING: /^(toc heading|tocheading|nagłówek spisu treści|nag[łl]?[oó]?wekspisutre[śs]?ci|inhaltsverzeichnisüberschrift)$/i,
  TITLE: /^(title|tytuł|tytul|titel|titre|título)$/i,
  QUOTE: /quote|cytat|zitat|citation|cita/i,
  CODE: /(^|[\s_-])(code|source|kod|preformatted|plain text|zwykły tekst|macro text|quelltext)([\s_-]|$)|^html ?preformatted$|^code/i,
  CODE_CHARACTER: /^(html ?code|code|kod|source ?code|inline ?code|verbatim)/i,
};
