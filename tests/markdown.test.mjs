import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRawMarkdown } from '../web/src/markdown.ts';

test('renders CommonMark and GFM structures with source line anchors', () => {
  const html = renderRawMarkdown('# 제목\n\n**굵게** *기울임* ~~취소~~\n\n- [x] 완료\n- [ ] 진행\n\n| 열 | 값 |\n| --- | --- |\n| a | b |\n');
  assert.match(html, /<h1[^>]*data-source-line="1"[^>]*data-source-end-line="1"/);
  assert.match(html, /<strong>굵게<\/strong>/);
  assert.match(html, /<em>기울임<\/em>/);
  assert.match(html, /<s>취소<\/s>/);
  assert.match(html, /class="task-list-item-checkbox"[^>]*checked=""/);
  assert.match(html, /<table[^>]*data-source-line="8"/);
  assert.match(html, /<li[^>]*data-source-line="5"/);
});

test('renders footnotes, definition lists, sub/superscripts, marks and emoji', () => {
  const html = renderRawMarkdown('주석[^a] H~2~O x^2^ ==강조== :smile:\n\n[^a]: 설명\n\n용어\n: 정의\n');
  for (const expression of [/footnote-ref/, /footnote-item/, /<dl/, /<dt[^>]*>용어/, /<dd[^>]*>정의/, /<sub>2<\/sub>/, /<sup>2<\/sup>/, /<mark>강조<\/mark>/, /😄/]) assert.match(html, expression);
});

test('math uses KaTeX, preserves source anchors, and leaves currency or escaped dollars alone', () => {
  const html = renderRawMarkdown('수식 $x^2$와 가격 $20, 그리고 $30\n\n$$\n\\frac{a}{b}\n$$\n\n$$x + y$$\n\n\\$literal\n');
  assert.match(html, /class="katex"/);
  assert.match(html, /class="math-block" data-source-line="3" data-source-end-line="5"/);
  assert.match(html, /class="math-block" data-source-line="7"/);
  assert.match(html, /가격 \$20, 그리고 \$30/);
  assert.match(html, /\$literal/);
  assert.equal((html.match(/class="math-block"/g) || []).length, 2);
});

test('invalid or unclosed math remains visible without throwing', () => {
  assert.match(renderRawMarkdown('$\\frac{$'), /katex-error/);
  assert.match(renderRawMarkdown('$$\nunclosed'), /\$\$/);
});

test('code fences highlight known syntax and escape unknown languages', () => {
  const html = renderRawMarkdown('```js\nconst x = 1;\n```\n\n```unknownlang\n<img onerror="bad">\n```\n');
  assert.match(html, /<pre data-source-line="1" data-source-end-line="3"/);
  assert.match(html, /hljs-keyword/);
  assert.match(html, /&lt;img onerror=/);
  assert.doesNotMatch(html, /<img onerror/);
});

test('mermaid remains escaped source until browser rendering completes', () => {
  const html = renderRawMarkdown('```mermaid\ngraph TD\nA["<script>bad</script>"] --> B\n```');
  assert.match(html, /class="mermaid-block" data-source-line="1" data-source-end-line="4"/);
  assert.match(html, /class="mermaid-source"/);
  assert.match(html, /&lt;script&gt;/);
});

test('links reject executable protocols, attributes are restricted, relative images survive', () => {
  const html = renderRawMarkdown('[bad](javascript:alert(1))\n\n![이미지](images/photo.png)\n\n# 제목 {#title .wide onclick=bad}\n');
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /src="images\/photo.png"/);
  assert.match(html, /id="title"/);
  assert.match(html, /class="wide"/);
  assert.doesNotMatch(html, /<h1[^>]*onclick=/);
});

test('supports safe raw HTML structures and fenced note containers', () => {
  const html = renderRawMarkdown('<details><summary>펼치기</summary>내용</details>\n\n::: note\n안내\n:::\n');
  assert.match(html, /<details><summary>펼치기<\/summary>/);
  assert.match(html, /<div[^>]*class="note"/);
});

test('GitHub alerts receive a style class and keep their Markdown body', () => {
  const html = renderRawMarkdown('> [!WARNING]\n> **주의** 문장\n');
  assert.match(html, /class="markdown-alert markdown-alert-warning"/);
  assert.match(html, /<strong>WARNING<\/strong>/);
  assert.match(html, /<strong>주의<\/strong>/);
  assert.doesNotMatch(html, /\[!WARNING\]/);
});

test('heading anchors support links, Unicode, inline formatting and deterministic duplicates', () => {
  const source = '[Usage](#usage)\n\n## Usage\n\n## Usage\n\n## 사용 방법!\n\n## 사용 방법!\n\n## **Hello** `World` & friends\n';
  const html = renderRawMarkdown(source);
  assert.match(html, /href="#usage"/);
  for (const id of ['usage', 'usage-1', '사용-방법', '사용-방법-1', 'hello-world-friends']) {
    assert.match(html, new RegExp(`<h2[^>]*id="${id}"`));
  }
  assert.equal(renderRawMarkdown(source), html, 'ID state resets for every render');
});

test('generated heading IDs avoid explicit IDs and footnote targets', () => {
  const html = renderRawMarkdown('## Usage\n\n## Custom {#usage}\n\n## fn1\n\n## fnref1\n\n참조[^note]\n\n[^note]: 각주\n');
  assert.match(html, /<h2[^>]*id="usage-1"[^>]*>Usage/);
  assert.match(html, /<h2[^>]*id="usage"[^>]*>Custom/);
  assert.match(html, /<h2[^>]*id="fn1-1"/);
  assert.match(html, /<h2[^>]*id="fnref1-1"/);
  assert.match(html, /<li id="fn1"/);
});
