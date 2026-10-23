export interface FormatChange {
  from: number;
  to: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
}

/** A single editor transaction; selection offsets refer to the resulting document. */
export function formatSelection(text: string, from: number, to: number, kind: string): FormatChange {
  from = Math.max(0, Math.min(text.length, Math.trunc(from)));
  to = Math.max(from, Math.min(text.length, Math.trunc(to)));
  const selected = text.slice(from, to);
  const change = (insert: string, start = 0, end = insert.length, startAt = from, endAt = to): FormatChange => ({
    from: startAt, to: endAt, insert, selectionFrom: startAt + start, selectionTo: startAt + end,
  });
  const wrap = (before: string, after = before, placeholder = '텍스트'): FormatChange => {
    if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
      return change(selected.slice(before.length, selected.length - after.length));
    }
    if (text.slice(Math.max(0, from - before.length), from) === before && text.slice(to, to + after.length) === after) {
      return change(selected, 0, selected.length, from - before.length, to + after.length);
    }
    const content = selected || placeholder;
    return change(before + content + after, before.length, before.length + content.length);
  };
  switch (kind) {
    case 'bold': return wrap('**');
    case 'italic': return wrap('*');
    case 'underline': return wrap('<u>', '</u>');
    case 'strike': return wrap('~~');
    case 'code': {
      const longest = Math.max(0, ...(selected.match(/`+/g) || []).map(run => run.length));
      const delimiter = '`'.repeat(longest + 1);
      const content = selected || '코드';
      const padding = /^[` ]|[` ]$/.test(content) ? ' ' : '';
      return change(delimiter + padding + content + padding + delimiter,
        delimiter.length + padding.length, delimiter.length + padding.length + content.length);
    }
    case 'link':
    case 'image': {
      const label = (selected || (kind === 'image' ? '이미지 설명' : '링크 텍스트')).replace(/([\\\[\]])/g, '\\$1');
      const prefix = (kind === 'image' ? '![' : '[') + label + '](';
      const url = 'https://';
      return change(prefix + url + ')', prefix.length, prefix.length + url.length);
    }
    case 'codeblock': {
      const fence = '`'.repeat(Math.max(3, ...((selected.match(/`+/g) || []).map(run => run.length + 1))));
      const prefix = (from > 0 && text[from - 1] !== '\n' ? '\n' : '') + fence + '\n';
      const content = selected || '코드';
      const suffix = '\n' + fence + (to < text.length && text[to] !== '\n' ? '\n' : '');
      return change(prefix + content + suffix, prefix.length, prefix.length + content.length);
    }
    case 'hr': {
      const insert = (from > 0 && text[from - 1] !== '\n' ? '\n\n' : '\n') + '---\n\n';
      return change(insert, insert.length, insert.length);
    }
  }
  const lineKinds: Record<string, string> = { h1: '# ', h2: '## ', h3: '### ', bullet: '- ', ordered: '1. ', quote: '> ', task: '- [ ] ' };
  const prefix = lineKinds[kind];
  if (!prefix) return change(selected);
  const start = from === 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1;
  const endSearch = to > from && text[to - 1] === '\n' ? to - 1 : to;
  const nextNewline = text.indexOf('\n', endSearch);
  const end = nextNewline < 0 ? text.length : nextNewline;
  const lines = text.slice(start, end).split('\n');
  const patterns: Record<string, RegExp> = {
    h1: /^# /, h2: /^## /, h3: /^### /, bullet: /^[-+*] /,
    ordered: /^\d+[.)] /, quote: /^> ?/, task: /^[-+*] \[[ xX]\] /,
  };
  const pattern = patterns[kind];
  const remove = lines.every(line => pattern.test(line));
  const insert = lines.map((line, index) => {
    if (remove) return line.replace(pattern, '');
    if (/^h[123]$/.test(kind)) return prefix + line.replace(/^#{1,6} /, '');
    return (kind === 'ordered' ? `${index + 1}. ` : prefix) + line;
  }).join('\n');
  return change(insert, 0, insert.length, start, end);
}
