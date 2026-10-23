import { build } from 'esbuild';
import { dirname } from 'node:path';
import { mkdir, copyFile, cp, rm, readFile } from 'node:fs/promises';

const options = {
  bundle: true,
  splitting: false,
  format: 'iife',
  target: ['safari17'],
  entryNames: 'app',
  assetNames: 'assets/[name]-[hash]',
  loader: { '.woff': 'file', '.woff2': 'dataurl', '.ttf': 'file' },
  plugins: [{
    name: 'portable-math-fonts',
    setup(build) {
      build.onLoad({ filter: /katex\.min\.css$/ }, async args => ({
        contents: (await readFile(args.path, 'utf8')).replace(/src:(url\(fonts\/[^)]+\.woff2\) format\("woff2"\)),[^}]+/g, 'src:$1'),
        loader: 'css',
        resolveDir: dirname(args.path),
      }));
    },
  }],
  minify: true,
  sourcemap: true,
  logLevel: 'info',
};

// Classic scripts work with WKWebView's local file URL security policy.
for (const [entry, out, html] of [
  ['web/src/main.ts', 'build/web', 'web/index.html'],
  ['web/preview/main.ts', 'build/preview', 'web/preview/index.html'],
]) {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await build({ ...options, entryPoints: [entry], outdir: out });
  await copyFile(html, `${out}/index.html`);
}
await cp('assets/icon.svg', 'build/web/icon.svg');
