'use strict';

const OOXML = 'http://schemas.openxmlformats.org/';
const STRICT = 'http://purl.oclc.org/ooxml/';
const MICROSOFT = 'http://schemas.microsoft.com/office/word/2010/';

module.exports = {
  [OOXML + 'wordprocessingml/2006/main']: 'w',
  [STRICT + 'wordprocessingml/main']: 'w',
  [OOXML + 'officeDocument/2006/relationships']: 'r',
  [STRICT + 'officeDocument/relationships']: 'r',
  [OOXML + 'package/2006/relationships']: 'rel',
  [OOXML + 'drawingml/2006/main']: 'a',
  [STRICT + 'drawingml/main']: 'a',
  [OOXML + 'drawingml/2006/wordprocessingDrawing']: 'wp',
  [STRICT + 'drawingml/wordprocessingDrawing']: 'wp',
  [OOXML + 'drawingml/2006/picture']: 'pic',
  [OOXML + 'drawingml/2006/chart']: 'c',
  [OOXML + 'drawingml/2006/diagram']: 'dgm',
  [OOXML + 'officeDocument/2006/math']: 'm',
  [OOXML + 'markup-compatibility/2006']: 'mc',
  [MICROSOFT + 'wordprocessingShape']: 'wps',
  [MICROSOFT + 'wordprocessingGroup']: 'wpg',
  'urn:schemas-microsoft-com:vml': 'v',
  'urn:schemas-microsoft-com:office:office': 'o',
  'http://www.w3.org/XML/1998/namespace': 'xml',
};
