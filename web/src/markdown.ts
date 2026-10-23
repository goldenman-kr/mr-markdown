import MarkdownIt, { type MarkdownIt as MarkdownParser, type Token } from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import deflist from 'markdown-it-deflist';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import mark from 'markdown-it-mark';
import { full as emoji } from 'markdown-it-emoji';
import attrs from 'markdown-it-attrs';
import containerPlugin from 'markdown-it-container';
import katex from 'katex';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

const md: MarkdownParser = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
  highlight(code, language): string {
    if (language && hljs.getLanguage(language)) {
      try { return hljs.highlight(code, { language, ignoreIllegals: true }).value; }
      catch { /* Unknown or incomplete syntax remains plain text. */ }
    }
    return md.utils.escapeHtml(code);
  },
});

md.use(footnote).use(taskLists, { enabled: false }).use(deflist).use(sub).use(sup).use(mark)
  .use(emoji).use(attrs, { allowedAttributes: ['id', 'class', 'width', 'height'] });
for (const type of ['note', 'tip', 'warning', 'important', 'caution', 'details']) md.use(containerPlugin, type);

function mathHTML(content: string, displayMode: boolean): string {
  return katex.renderToString(content, {
    displayMode, throwOnError: false, trust: false, strict: 'ignore',
    maxExpand: 1000, maxSize: 20,
  });
}

md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
  const start = state.pos;
  if (state.src[start] !== '$' || state.src[start + 1] === '$' || /\s/.test(state.src[start + 1] || ' ')) return false;
  let end = start + 1;
  while ((end = state.src.indexOf('$', end)) >= 0) {
    let slashes = 0;
    for (let index = end - 1; index > start && state.src[index] === '\\'; index--) slashes++;
    if (slashes % 2 === 0) break;
    end++;
  }
  if (end < 0 || state.src.slice(start + 1, end).includes('\n') || /\s/.test(state.src[end - 1]) || /\d/.test(state.src[end + 1] || '')) return false;
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.content = state.src.slice(start + 1, end);
  }
  state.pos = end + 1;
  return true;
});

md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4 || state.src.slice(start, start + 2) !== '$$') return false;
  const firstLine = state.src.slice(start + 2, state.eMarks[startLine]);
  const singleEnd = firstLine.indexOf('$$');
  let nextLine = startLine + 1;
  let content: string;
  if (singleEnd >= 0 && firstLine.slice(singleEnd + 2).trim() === '') {
    content = firstLine.slice(0, singleEnd);
  } else {
    let closeLine = -1;
    for (let line = nextLine; line < endLine; line++) {
      const value = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
      if (value.trim() === '$$') { closeLine = line; break; }
    }
    if (closeLine < 0) return false;
    content = firstLine + '\n' + state.getLines(nextLine, closeLine, state.blkIndent, false);
    nextLine = closeLine + 1;
  }
  if (silent) return true;
  const token = state.push('math_block', 'div', 0);
  token.block = true;
  token.content = content.trim();
  token.map = [startLine, nextLine];
  state.line = nextLine;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });

// Keep line ranges on the original block tokens so each scroll anchor reflects the source.
md.core.ruler.push('source_lines', state => {
  for (const token of state.tokens) {
    if (token.map && token.block && token.nesting !== -1 && token.type !== 'inline') {
      token.attrSet('data-source-line', String(token.map[0] + 1));
      token.attrSet('data-source-end-line', String(Math.max(token.map[0] + 1, token.map[1])));
    }
  }
});

md.core.ruler.push('github_alerts', state => {
  for (let index = 0; index < state.tokens.length - 2; index++) {
    const quote = state.tokens[index];
    const inline = state.tokens[index + 2];
    if (quote.type !== 'blockquote_open' || state.tokens[index + 1].type !== 'paragraph_open' || inline.type !== 'inline') continue;
    const alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/.exec(inline.content);
    if (!alert) continue;
    const type = alert[1].toLowerCase();
    quote.attrJoin('class', `markdown-alert markdown-alert-${type}`);
    inline.content = `**${alert[1]}**\n${inline.content.slice(alert[0].length)}`;
    inline.children = [];
    md.inline.parse(inline.content, md, state.env, inline.children);
  }
});

md.core.ruler.push('heading_ids', state => {
  // Reserve explicit IDs first, including IDs later in the document, before generating any.
  const used = new Set<string>();
  const reserve = (tokens: Token[]) => {
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const explicit = token.attrGet('id');
      if (explicit) used.add(String(explicit));
      if (token.type === 'footnote_open' || token.type === 'footnote_ref') {
        const name = md.renderer.rules.footnote_anchor_name!(tokens, index, md.options, state.env, md.renderer);
        const subId = Number(token.meta?.subId || 0);
        const suffix = subId > 0 ? `:${subId}` : '';
        used.add(token.type === 'footnote_open' ? `fn${name}${suffix}` : `fnref${name}${suffix}`);
      }
      if (token.children) reserve(token.children);
    }
  };
  reserve(state.tokens);
  const headingText = (tokens: Token[]): string => tokens.map(token => {
    if (token.children) return headingText(token.children);
    if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
    return ['text', 'code_inline', 'math_inline', 'image', 'emoji'].includes(token.type) ? token.content : '';
  }).join('');
  for (let index = 0; index < state.tokens.length - 1; index++) {
    const heading = state.tokens[index];
    if (heading.type !== 'heading_open' || heading.attrGet('id')) continue;
    const inline = state.tokens[index + 1];
    const text = headingText(inline.children || []).normalize('NFC').toLowerCase().trim();
    const base = text.replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s+/g, '-') || 'section';
    let id = base;
    let suffix = 0;
    while (used.has(id)) id = `${base}-${++suffix}`;
    heading.attrSet('id', id);
    used.add(id);
  }
});

function blockAttrs(token: Token): string {
  return md.renderer.renderAttrs(token);
}

md.renderer.rules.math_inline = (tokens, index) => mathHTML(tokens[index].content, false);
md.renderer.rules.math_block = (tokens, index) => `<div class="math-block"${blockAttrs(tokens[index])}>${mathHTML(tokens[index].content, true)}</div>\n`;

const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  if (token.info.trim().split(/\s+/)[0] === 'mermaid') {
    return `<div class="mermaid-block"${blockAttrs(token)}><pre class="mermaid-source">${md.utils.escapeHtml(token.content)}</pre></div>\n`;
  }
  // markdown-it puts token attributes on <code>; the containing <pre> is the scroll anchor.
  const rendered = defaultFence(tokens, index, options, env, renderer);
  return rendered.replace('<pre>', `<pre${blockAttrs(token)}>`);
};
md.renderer.rules.code_block = (tokens, index) => `<pre${blockAttrs(tokens[index])}><code>${md.utils.escapeHtml(tokens[index].content)}</code></pre>\n`;
md.renderer.rules.html_block = (tokens, index) => `<div${blockAttrs(tokens[index])}>${tokens[index].content}</div>\n`;

/** Parser output for Node tests. DOM insertion must always use renderMarkdown instead. */
export function renderRawMarkdown(source: string): string {
  return md.render(source);
}

/** Sanitized HTML including safe HTML, SVG and MathML used by Markdown and KaTeX. */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(renderRawMarkdown(source), {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_ATTR: ['data-source-line', 'data-source-end-line'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link', 'style'],
    FORBID_ATTR: ['srcdoc'],
  });
}

let diagramSequence = 0;
let diagramQueue: Promise<void> = Promise.resolve();
const diagramVersions = new WeakMap<HTMLElement, number>();

/** Mermaid has global configuration; serialize work and discard stale document generations. */
export async function renderDiagrams(container: HTMLElement, dark: boolean): Promise<void> {
  const generation = (diagramVersions.get(container) || 0) + 1;
  diagramVersions.set(container, generation);
  const blocks = [...container.querySelectorAll<HTMLElement>('.mermaid-block')];
  if (!blocks.length) return;
  const current = () => diagramVersions.get(container) === generation && container.isConnected;
  const work = async () => {
    if (!current()) return;
    const { default: mermaid } = await import('mermaid');
    if (!current()) return;
    mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', htmlLabels: false,
      suppressErrorRendering: true,
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'themeCSS', 'fontFamily', 'altFontFamily', 'htmlLabels'],
      maxTextSize: 50000, maxEdges: 1000,
      flowchart: { htmlLabels: false },
    });
    for (const block of blocks) {
      const source = block.querySelector<HTMLElement>('.mermaid-source');
      if (!source || !current() || !container.contains(block)) continue;
      const code = source.textContent || '';
      try {
        const { svg } = await mermaid.render(`md-diagram-${++diagramSequence}`, code);
        if (!current() || !container.contains(block) || !block.contains(source)) continue;
        block.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ['foreignObject', 'script'], FORBID_ATTR: ['onload', 'onclick'],
        });
        block.setAttribute('role', 'img');
        block.setAttribute('aria-label', 'Mermaid 다이어그램');
      } catch {
        if (!current() || !container.contains(block)) continue;
        block.classList.add('diagram-error');
        block.setAttribute('title', '다이어그램 문법을 확인하세요.');
      }
    }
  };
  const next = diagramQueue.then(work, work);
  diagramQueue = next.catch(() => {});
  await next;
}
