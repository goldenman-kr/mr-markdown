import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const sections=['Mr. Markdown third-party notices\n\nThis application bundles the following open source packages. Font and package licenses are reproduced below.'];
for(const [path,entry] of Object.entries(lock.packages).sort(([a],[b])=>a.localeCompare(b))){
  if(!path||entry.dev)continue;
  try{
    const pkg=JSON.parse(await readFile(join(path,'package.json'),'utf8'));
    const files=(await readdir(path)).filter(name=>/^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
    const texts=[];
    for(const file of files){try{texts.push(`${file}:\n${await readFile(join(path,file),'utf8')}`);}catch{/* directories are not license text */}}
    sections.push(`${pkg.name} ${pkg.version}\nLicense: ${pkg.license||entry.license||'See package source'}\n${texts.join('\n\n')}`);
  }catch{/* optional platform package not installed */}
}
await writeFile('assets/THIRD-PARTY-NOTICES.txt',sections.join('\n\n'+'='.repeat(72)+'\n\n'));
