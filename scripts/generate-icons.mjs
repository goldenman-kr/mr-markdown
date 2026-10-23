import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1});
await page.setContent(`<style>body{margin:0;background:transparent}svg{display:block}</style>${await readFile('assets/icon.svg','utf8')}`);
await page.screenshot({path:'assets/AppIcon.png',omitBackground:true});await browser.close();
await mkdir('build/AppIcon.iconset',{recursive:true});
for(const size of [16,32,128,256,512]){
  for(const scale of [1,2])execFileSync('sips',['-z',String(size*scale),String(size*scale),'assets/AppIcon.png','--out',`build/AppIcon.iconset/icon_${size}x${size}${scale===2?'@2x':''}.png`],{stdio:'ignore'});
}
execFileSync('iconutil',['-c','icns','build/AppIcon.iconset','-o','assets/AppIcon.icns']);
console.log('Created assets/AppIcon.png and AppIcon.icns');
