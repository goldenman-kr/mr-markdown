declare module 'markdown-it-task-lists' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt, options?: { enabled?: boolean; label?: boolean; labelAfter?: boolean }) => void;
  export default plugin;
}
declare module 'markdown-it-deflist' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
declare module 'markdown-it-sub' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
declare module 'markdown-it-sup' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
declare module 'markdown-it-mark' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}
declare module 'markdown-it-emoji' {
  import type { MarkdownIt } from 'markdown-it';
  export const full: (md: MarkdownIt) => void;
}
declare module 'markdown-it-attrs' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt, options?: { allowedAttributes?: (string | RegExp)[] }) => void;
  export default plugin;
}
declare module 'markdown-it-container' {
  import type { MarkdownIt } from 'markdown-it';
  const plugin: (md: MarkdownIt, name: string) => void;
  export default plugin;
}
