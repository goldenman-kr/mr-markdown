import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSelection } from '../web/src/format.ts';

function apply(text, from, to, kind) {
  const edit = formatSelection(text, from, to, kind);
  const result = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
  return { ...edit, text: result, selected: result.slice(edit.selectionFrom, edit.selectionTo) };
}

test('inline formatting keeps raw text selected and toggles surrounding markers', () => {
  for (const [kind, before, after] of [['bold', '**', '**'], ['italic', '*', '*'], ['underline', '<u>', '</u>'], ['strike', '~~', '~~']]) {
    const wrapped = apply('한글 문장', 0, 2, kind);
    assert.equal(wrapped.text, `${before}한글${after} 문장`);
    assert.equal(wrapped.selected, '한글');
    assert.equal(apply(wrapped.text, wrapped.selectionFrom, wrapped.selectionTo, kind).text, '한글 문장');
    assert.equal(apply(`${before}한글${after}`, 0, before.length + 2 + after.length, kind).text, '한글');
  }
});

test('empty inline selection inserts an editable placeholder', () => {
  const result = apply('', 0, 0, 'bold');
  assert.equal(result.text, '**텍스트**');
  assert.equal(result.selected, '텍스트');
});

test('code spans choose a delimiter that cannot conflict with selected backticks', () => {
  const result = apply('`hello`', 0, 7, 'code');
  assert.equal(result.text, '`` `hello` ``');
  assert.equal(result.selected, '`hello`');
});

test('links and images escape label brackets and select the URL for entry', () => {
  assert.equal(apply('a[b]', 0, 4, 'link').text, '[a\\[b\\]](https://)');
  assert.equal(apply('사진', 0, 2, 'image').text, '![사진](https://)');
  assert.equal(apply('사진', 0, 2, 'image').selected, 'https://');
});

test('heading tools replace existing heading level and operate on complete lines', () => {
  assert.equal(apply('before\n### 제목\nafter', 10, 11, 'h1').text, 'before\n# 제목\nafter');
  for (let level = 1; level <= 3; level++) {
    const result = apply('제목', 0, 2, `h${level}`);
    assert.equal(result.text, '#'.repeat(level) + ' 제목');
    assert.equal(apply(result.text, 0, result.text.length, `h${level}`).text, '제목');
  }
});

test('list formatting spans selected lines, numbers sequentially and can toggle off', () => {
  for (const [kind, expected] of [['bullet', '- one\n- two'], ['ordered', '1. one\n2. two'], ['quote', '> one\n> two'], ['task', '- [ ] one\n- [ ] two']]) {
    const result = apply('one\ntwo\nthree', 0, 8, kind);
    assert.equal(result.text, expected + '\nthree');
    assert.equal(apply(result.text, 0, expected.length, kind).text, 'one\ntwo\nthree');
  }
});

test('code blocks cannot be closed by their content and separate adjacent text', () => {
  const result = apply('a```b', 1, 4, 'codeblock');
  assert.equal(result.text, 'a\n````\n```\n````\nb');
  assert.equal(result.selected, '```');
});

test('horizontal rule leaves caret after the rule; unknown actions are no-ops', () => {
  const result = apply('ab', 1, 1, 'hr');
  assert.equal(result.text, 'a\n\n---\n\nb');
  assert.equal(result.selectionFrom, result.selectionTo);
  assert.equal(apply('abc', 1, 2, 'unknown').text, 'abc');
});

test('selection bounds are clamped and initial blank lines remain selectable', () => {
  assert.equal(apply('abc', -10, 100, 'bold').text, '**abc**');
  assert.equal(apply('\na', 0, 0, 'quote').text, '> \na');
});
