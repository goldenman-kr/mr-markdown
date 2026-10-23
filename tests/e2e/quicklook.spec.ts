import { test, expect, Page } from '@playwright/test';
async function preview(page:Page,text:string,requestId='test') {
  await page.evaluate(({text,requestId})=>(window as any).MDPreview.load({text,requestId,name:'미리보기.md',baseURL:'mdpreview-image://document/'}),{text,requestId});
  await expect(page.locator('#preview')).toHaveAttribute('data-render-state','ready');
}
test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    (window as any).__previewMessages=[];
    (window as any).webkit={messageHandlers:{preview:{postMessage:(message:unknown)=>(window as any).__previewMessages.push(message)}}};
  });
  await page.goto('/quicklook/');await page.waitForFunction(()=>!!(window as any).MDPreview);
});
test('Finder page renders Markdown extensions without editing UI',async({page})=>{
  await preview(page,'# 저장된 문서\n\n**굵은 글자**\n\n| 항목 | 값 |\n| --- | --- |\n| 상태 | 완료 |\n\n수식 $E=mc^2$\n\n```mermaid\ngraph LR\n A[시작] --> B[완료]\n```');
  await expect(page.locator('h1')).toHaveText('저장된 문서');await expect(page.locator('strong')).toHaveText('굵은 글자');
  await expect(page.locator('table')).toHaveCount(1);await expect(page.locator('.katex')).toHaveCount(1);await expect(page.locator('.mermaid-block svg')).toBeVisible();
  await expect(page.locator('textarea,[contenteditable=true],.cm-editor,button,select')).toHaveCount(0);
  await expect(page.locator('#preview')).toHaveCSS('word-break','keep-all');
  expect(await page.evaluate(()=>(window as any).__previewMessages)).toEqual([{type:'ready'},{type:'rendered',requestId:'test',loadedImages:0}]);
  await page.screenshot({path:'.omx/artifacts/quicklook-light.png'});
});
test('untrusted markup and external navigation remain inert',async({page})=>{
  const external:string[]=[];page.on('request',r=>{if(r.url().startsWith('https://example.com'))external.push(r.url());});
  await preview(page,'# 안전\n\n<script>window.PWNED=1</script><iframe src="https://example.com"></iframe><img src="https://example.com/track.png" onerror="window.PWNED=1">\n\n[외부](https://example.com)');
  await expect(page.locator('#preview script,#preview iframe,#preview [onerror]')).toHaveCount(0);
  await expect(page.locator('#preview img')).not.toHaveAttribute('src');
  await page.getByRole('link',{name:'외부'}).click();expect(page.url()).toContain('/quicklook/');
  expect(await page.evaluate(()=>(window as any).PWNED)).toBeUndefined();expect(external).toEqual([]);
});
test('new request replaces slow diagrams and empty files have a visible state',async({page})=>{
  await page.evaluate(()=>{const p=(window as any).MDPreview;p.load({text:'```mermaid\ngraph LR\n A --> B\n```',name:'old.md',requestId:'old'});p.load({text:'# 최신 파일',name:'new.md',requestId:'new'});});
  await expect(page.locator('#preview')).toHaveAttribute('data-render-state','ready');
  await expect(page.locator('h1')).toHaveText('최신 파일');await expect(page.locator('svg')).toHaveCount(0);
  const messages=await page.evaluate(()=>(window as any).__previewMessages.filter((m:any)=>m.type==='rendered'));
  expect(messages).toEqual([{type:'rendered',requestId:'new',loadedImages:0}]);
  await preview(page,'','empty');await expect(page.locator('#preview')).toHaveText('빈 마크다운 문서입니다.');
});
test('system appearance changes rerender diagrams and embedded images finish loading',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'});
  await preview(page,'# 야간 미리보기\n\n![점](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1EAAAAASUVORK5CYII=)');
  await expect(page.locator('body')).toHaveClass(/dark/);
  expect(await page.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.screenshot({path:'.omx/artifacts/quicklook-dark.png'});
  await page.emulateMedia({colorScheme:'light'});await expect(page.locator('body')).not.toHaveClass(/dark/);
});
