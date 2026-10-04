'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { r, p } = require('./support/docx');
const { md } = require('./support/convert');

test('footnotes and endnotes become GFM footnotes', () => {
  const footnotes = '<w:footnote w:type="separator" w:id="-1">' + p('<w:r><w:separator/></w:r>') + '</w:footnote>' +
    '<w:footnote w:id="1">' + p('<w:r><w:footnoteRef/></w:r>' + r(' Source: ') + r('ISO', '<w:i/>')) + '</w:footnote>';
  const endnotes = '<w:endnote w:id="1">' + p(r('An endnote.')) + '</w:endnote>';
  const body = p(r('Claim') + '<w:r><w:footnoteReference w:id="1"/></w:r>' + r(' more') + '<w:r><w:endnoteReference w:id="1"/></w:r>');
  assert.equal(md(body, { footnotes, endnotes }), 'Claim[^1] more[^2]\n\n[^1]: Source: *ISO*\n\n[^2]: An endnote.\n');
});

test('comments become footnotes with the author, or are omitted', () => {
  const comments = '<w:comment w:id="0" w:author="Author">' + p(r('Check this')) + '</w:comment>';
  const body = p('<w:commentRangeStart w:id="0"/>' + r('Text') + '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>');
  assert.equal(md(body, { comments }), 'Text[^c1]\n\n[^c1]: **Author:** Check this\n');
  assert.equal(md(body, { comments }, { comments: 'omit' }), 'Text\n');
});

test('tracked changes: accept, reject, markup', () => {
  const body = p(r('Keep ') + '<w:ins w:id="1" w:author="A">' + r('new') + '</w:ins>' +
    '<w:del w:id="2" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del>' + r(' end'));
  assert.equal(md(body), 'Keep new end\n');
  assert.equal(md(body, {}, { trackedChanges: 'reject' }), 'Keep old end\n');
  assert.equal(md(body, {}, { trackedChanges: 'markup' }), 'Keep <ins>new</ins><del>old</del> end\n');
});
