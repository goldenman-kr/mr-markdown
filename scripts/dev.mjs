import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('build/web');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.map':'application/json'};
const server = createServer(async (req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const preview = pathname === '/quicklook' || pathname.startsWith('/quicklook/');
    const activeRoot = preview ? resolve('build/preview') : root;
    const activePath = preview ? pathname.slice('/quicklook'.length) || '/' : pathname;
    const file = resolve(activeRoot, `.${activePath === '/' ? '/index.html' : activePath}`);
    if (file !== activeRoot && !file.startsWith(activeRoot+sep)) {res.writeHead(403).end(); return;}
    if (!(await stat(file)).isFile()) {res.writeHead(404).end(); return;}
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(await readFile(file));
  } catch {res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1',()=>console.log('Mr. Markdown preview: http://127.0.0.1:4173'));
