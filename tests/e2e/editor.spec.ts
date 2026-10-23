import { test, expect, Page } from '@playwright/test';
async function load(page:Page,text:string,name='테스트.md'){
  await page.evaluate(({text,name})=>(window as any).MDEditor.receive({type:'load',text,name}),{text,name});
  await expect(page.locator('#file-name')).toHaveText(name);
  await page.waitForTimeout(180);
}
async function command(page:Page,command:string,extra={}){await page.evaluate(({command,extra})=>(window as any).MDEditor.receive({type:'command',command,...extra}),{command,extra});}
async function text(page:Page){return page.evaluate(()=>(window as any).MDEditor.getText());}
test.beforeEach(async({page})=>{await page.goto('/');await page.waitForFunction(()=>!!(window as any).MDEditor);});

test('renders source and read-only preview, Korean words keep together',async({page})=>{
  await expect(page.getByLabel('Mr. Markdown',{exact:true})).toBeVisible();
  await expect(page).toHaveTitle(/ — Mr\. Markdown$/);
  await expect(page.locator('#preview h1')).toContainText('마크다운 작업실');
  await expect(page.getByRole('textbox',{name:'마크다운 원문 편집'})).toBeVisible();
  await expect(page.locator('#preview')).not.toHaveAttribute('contenteditable');
  await expect(page.locator('#preview')).toHaveCSS('word-break','keep-all');
  await expect(page.locator('.cm-content')).toHaveCSS('word-break','keep-all');
  await expect(page.locator('#editor-dark')).not.toBeChecked();await expect(page.locator('#preview-dark')).not.toBeChecked();
  await page.screenshot({path:'.omx/artifacts/md-editor-light.png'});
});

test('selection formatting, raw markers, undo/redo and native clipboard bridge',async({page})=>{
  await load(page,'안녕하세요 world');
  await page.evaluate(()=>{const editor=(window as any).MDEditor.editor;editor.dispatch({selection:{anchor:0,head:5}});editor.focus();});
  await page.getByRole('button',{name:'굵게',exact:true}).click();
  expect(await text(page)).toBe('**안녕하세요** world');
  await expect(page.locator('#preview strong')).toHaveText('안녕하세요');
  await expect(page.locator('#dirty-status')).toHaveText('수정됨');
  await command(page,'undo');expect(await text(page)).toBe('안녕하세요 world');await expect(page.locator('#dirty-status')).toHaveText('');
  await command(page,'redo');expect(await text(page)).toBe('**안녕하세요** world');
  await command(page,'paste',{text:'반갑습니다'});expect(await text(page)).toContain('반갑습니다');
});

test('new document resets history and a save snapshot does not hide newer edits',async({page})=>{
  await load(page,'첫 파일');await command(page,'paste',{text:'추가'});
  await load(page,'다른 파일');await command(page,'undo');expect(await text(page)).toBe('다른 파일');
  await command(page,'paste',{text:'새 편집'});
  await page.evaluate(()=>(window as any).MDEditor.receive({type:'saved',text:'다른 파일',name:'저장.md'}));
  await expect(page.locator('#dirty-status')).toHaveText('수정됨');
});

test('independent appearance, inheritance and preferences survive reload',async({page})=>{
  await page.locator('#editor-font').selectOption('Georgia');await page.locator('#editor-size').fill('18');await page.locator('#editor-dark').check();
  await expect(page.locator('#editor-pane')).toHaveClass(/dark/);await expect(page.locator('#preview-pane')).not.toHaveClass(/dark/);
  await page.locator('#preview-inherit').check();
  for(const id of ['preview-font','preview-size','preview-dark'])await expect(page.locator(`#${id}`)).toBeDisabled();
  await expect(page.locator('#preview-font')).toHaveValue('Georgia');await expect(page.locator('#preview-size')).toHaveValue('18');await expect(page.locator('#preview-pane')).toHaveClass(/dark/);
  await page.screenshot({path:'.omx/artifacts/md-editor-dark.png'});
  await page.reload();await page.waitForFunction(()=>!!(window as any).MDEditor);await expect(page.locator('#editor-font')).toHaveValue('Georgia');await expect(page.locator('#preview-inherit')).toBeChecked();
  await page.locator('#preview-inherit').uncheck();await expect(page.locator('#preview-size')).toHaveValue('14');await expect(page.locator('#preview-pane')).not.toHaveClass(/dark/);
});

test('dark window chrome follows the visible pane without changing document or the other pane',async({page})=>{
  const original=await text(page);
  await page.locator('#editor-dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-chrome-theme','dark');
  for(const selector of ['.toolbar','.statusbar','#splitter'])await expect(page.locator(selector)).toHaveCSS('background-color','rgb(35, 38, 41)');
  await expect(page.locator('.toolbar')).toHaveCSS('color','rgb(213, 218, 219)');
  await expect(page.locator('#preview-pane')).toHaveCSS('color-scheme','light');
  await expect(page.locator('#preview')).toHaveCSS('color','rgb(48, 57, 61)');
  await page.locator('#layout-button').click();
  await expect(page.locator('#layout-menu')).toHaveCSS('background-color','rgb(44, 48, 50)');
  await page.locator('#layout-menu [data-layout=preview]').hover();
  await expect(page.locator('#layout-menu [data-layout=preview]')).toHaveCSS('background-color','rgb(60, 70, 68)');
  await page.locator('#layout-menu [data-layout=preview]').click();
  await expect(page.locator('html')).toHaveAttribute('data-chrome-theme','light');
  await page.locator('#preview-dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-chrome-theme','dark');
  await command(page,'toggleEditor');
  await page.locator('#preview-inherit').check();
  await page.locator('#layout-button').click();
  await page.screenshot({path:'.omx/artifacts/md-editor-1.0.2-dark-chrome.png'});
  await page.reload();await page.waitForFunction(()=>!!(window as any).MDEditor);
  await expect(page.locator('html')).toHaveAttribute('data-chrome-theme','dark');
  await page.locator('#editor-dark').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-chrome-theme','light');
  await expect(page.locator('.toolbar')).toHaveCSS('background-color','rgb(246, 247, 246)');
  await expect(page.locator('#preview-pane')).toHaveCSS('color-scheme','light');
  expect(await text(page)).toBe(original);await expect(page.locator('#dirty-status')).toHaveText('');
});

test('line numbers and pane visibility never hide both panes',async({page})=>{
  await expect(page.locator('.cm-lineNumbers')).toBeVisible();await command(page,'toggleLines');await expect(page.locator('.cm-lineNumbers')).toHaveCount(0);
  await command(page,'toggleEditor');await expect(page.locator('#editor-pane')).not.toBeVisible();await expect(page.locator('#preview-pane')).toBeVisible();
  await command(page,'togglePreview');await expect(page.locator('#editor-pane')).toBeVisible();await expect(page.locator('#preview-pane')).not.toBeVisible();
  await command(page,'togglePreview');await expect(page.locator('#preview-pane')).toBeVisible();
  await page.locator('#splitter').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#splitter')).toHaveAttribute('aria-valuenow','52');
});

test('find and replace change source with undo',async({page})=>{
  await load(page,'apple banana apple');await command(page,'replace');
  await page.locator('.cm-search input[name=search]').fill('apple');await page.locator('.cm-search input[name=replace]').fill('사과');
  await page.locator('.cm-search button[name=replaceAll]').click();
  expect(await text(page)).toBe('사과 banana 사과');await command(page,'undo');expect(await text(page)).toBe('apple banana apple');
});

test('Markdown extensions survive sanitization; executable markup and controls do not',async({page})=>{
  await load(page,'# 안전한 문서\n\n| A | B |\n| --- | --- |\n| 값 | 확인 |\n\n- [x] 완료\n\n본문[^a] $E=mc^2$\n\n[^a]: 각주\n\n<script>window.PWNED=1</script>\n<img src="bad" onerror="window.PWNED=1"><iframe srcdoc="x"></iframe><form><input></form>\n\n[위험](javascript:alert(1))\n\n![이미지](./picture.png)');
  await expect(page.locator('#preview table')).toHaveCount(1);await expect(page.locator('#preview .katex')).toHaveCount(1);await expect(page.locator('#preview .footnotes')).toHaveCount(1);
  await expect(page.locator('#preview script, #preview iframe, #preview form, #preview [onerror]')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).PWNED)).toBeUndefined();
  await expect(page.locator('#preview a[href^="javascript:"]')).toHaveCount(0);
});

test('Mermaid renders offline; stale generations do not overwrite current text',async({page})=>{
  await load(page,'```mermaid\ngraph LR\n A[시작] --> B[완료]\n```');
  await expect(page.locator('#preview .mermaid-block svg')).toBeVisible({timeout:20000});
  await expect(page.locator('#preview .mermaid-block')).toContainText('시작');
  await load(page,'```mermaid\ngraph LR\n C --> D\n```');await load(page,'# 마지막 문서');
  await expect(page.locator('#preview h1')).toHaveText('마지막 문서');await expect(page.locator('#preview svg')).toHaveCount(0);
});

test('center scroll maps asymmetric documents both ways and keyboard caret follows',async({page})=>{
  const content=Array.from({length:55},(_,i)=>`## 문단 ${i+1}\n\n${'한글 단어 단위로 줄을 바꾸는 긴 문장입니다. '.repeat(7)}\n\n${i%3===0?'```js\nconst hello = "world";\n```\n':''}`).join('\n');
  await load(page,content);await page.locator('#preview-size').fill('20');await page.locator('#editor-size').fill('10');await page.waitForTimeout(300);
  await page.evaluate(()=>{const editor=(window as any).MDEditor.editor;editor.scrollDOM.scrollTop=editor.scrollDOM.scrollHeight*.42;});await page.waitForTimeout(350);
  const centers=await page.evaluate(()=>{
    const editor=(window as any).MDEditor.editor,scroller=document.getElementById('preview-scroll')!;
    const center=editor.scrollDOM.getBoundingClientRect().top+editor.scrollDOM.clientHeight/2;
    const line=editor.state.doc.lineAt(editor.posAtCoords({x:editor.contentDOM.getBoundingClientRect().left+20,y:center})??0).number;
    const blocks=[...document.querySelectorAll<HTMLElement>('#preview [data-source-line]')];
    const y=scroller.getBoundingClientRect().top+scroller.clientHeight/2;
    const block=blocks.reduce((a,b)=>Math.abs(a.getBoundingClientRect().top-y)<Math.abs(b.getBoundingClientRect().top-y)?a:b);
    return {line,previewLine:Number(block.dataset.sourceLine),previewTop:scroller.scrollTop};
  });
  expect(centers.previewTop).toBeGreaterThan(200);expect(Math.abs(centers.line-centers.previewLine)).toBeLessThan(16);
  await page.evaluate(()=>{const s=document.getElementById('preview-scroll')!;s.scrollTop=s.scrollHeight*.65;});await page.waitForTimeout(350);
  expect(await page.evaluate(()=>(window as any).MDEditor.editor.scrollDOM.scrollTop)).toBeGreaterThan(1000);
  await page.locator('.cm-content').focus();await page.keyboard.press('Control+End');await page.waitForTimeout(400);
  // Browser test runner uses Control on Linux, Meta on macOS; use the command directly for deterministic cursor reveal.
  await page.evaluate(()=>{const e=(window as any).MDEditor.editor;e.dispatch({selection:{anchor:e.state.doc.length},scrollIntoView:true});e.focus();});await page.waitForTimeout(400);
  // A nearest-edge cursor reveal leaves source bottom padding visible. Synchronization
  // intentionally follows the viewport center, so verify the corresponding paragraph first.
  const keyboardCenter=await page.evaluate(()=>{
    const e=(window as any).MDEditor.editor,s=document.getElementById('preview-scroll')!;
    const y=e.scrollDOM.getBoundingClientRect().top+e.scrollDOM.clientHeight/2;
    const line=e.state.doc.lineAt(e.posAtCoords({x:e.contentDOM.getBoundingClientRect().left+20,y})??0).number;
    const py=s.getBoundingClientRect().top+s.clientHeight/2;
    const blocks=[...document.querySelectorAll<HTMLElement>('#preview [data-source-line]')];
    const nearest=blocks.reduce((a,b)=>Math.abs(a.getBoundingClientRect().top-py)<Math.abs(b.getBoundingClientRect().top-py)?a:b);
    return Math.abs(line-Number(nearest.dataset.sourceLine));
  });
  expect(keyboardCenter).toBeLessThan(16);
  await page.evaluate(()=>{const e=(window as any).MDEditor.editor;e.scrollDOM.scrollTop=e.scrollDOM.scrollHeight;});await page.waitForTimeout(300);
  const bottom=await page.locator('#preview-scroll').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop);expect(bottom).toBeLessThan(8);
});

test('print output contains rendered content and no editor chrome',async({page})=>{
  await load(page,'# 인쇄 제목\n\n**인쇄 본문**\n\n$x^2$');
  const html=await page.evaluate(()=>(window as any).MDEditor.printHTML());expect(html).toContain('인쇄 제목');expect(html).toContain('<strong>인쇄 본문</strong>');expect(html).toContain('katex');expect(html).not.toContain('id="editor"');
});

test('no runtime or asset errors on startup and font assets work offline',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.reload();await page.waitForFunction(()=>!!(window as any).MDEditor);await load(page,'# 확인\n\n$\\int_0^1 x^2 dx$');await page.evaluate(()=>document.fonts.ready);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.fonts.check('16px KaTeX_Main'))).toBe(true);
});


test('native clipboard actions respect find field focus',async({page})=>{
  await load(page,'원문 보존');await command(page,'find');
  const field=page.locator('.cm-search input[name=search]');await field.fill('찾을 단어');
  await field.evaluate((el:HTMLInputElement)=>el.select());await command(page,'paste',{text:'바뀐 검색어'});
  await expect(field).toHaveValue('바뀐 검색어');expect(await text(page)).toBe('원문 보존');
});

test('appearance controls remain reachable in small and narrow split panes',async({page})=>{
  await page.setViewportSize({width:840,height:560});
  await expect(page.locator('#preview-dark')).toBeVisible();await expect(page.locator('#editor-size')).toBeVisible();
  const clipped=await page.locator('.pane-header').evaluateAll(elements=>elements.some(el=>el.scrollWidth>el.clientWidth+1));expect(clipped).toBe(false);
  await page.locator('#splitter').focus();for(let i=0;i<12;i++)await page.keyboard.press('ArrowLeft');
  const narrower=await page.locator('.pane-header').evaluateAll(elements=>elements.some(el=>el.scrollWidth>el.clientWidth+1));expect(narrower).toBe(false);
});

test('Korean IME composition is included when prepareClose captures a save snapshot',async({page})=>{
  await load(page,'');await page.locator('.cm-content').focus();
  const session=await page.context().newCDPSession(page);
  await session.send('Input.imeSetComposition',{text:'ㅎ',selectionStart:1,selectionEnd:1});
  await session.send('Input.imeSetComposition',{text:'한',selectionStart:1,selectionEnd:1});
  await session.send('Input.imeSetComposition',{text:'한글',selectionStart:2,selectionEnd:2});
  const snapshot=await page.evaluate(()=>(window as any).MDEditor.prepareClose());
  expect(snapshot).toBe('한글');expect(await text(page)).toBe('한글');
});

test('printed formulas use self-contained fonts without network access',async({page,context})=>{
  await load(page,'# 인쇄\n\n$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$');
  const html=await page.evaluate(()=>(window as any).MDEditor.printHTML());
  expect(html).toContain('data:font/woff2;base64,');
  const printPage=await context.newPage();await context.setOffline(true);
  await printPage.setContent(html);await printPage.evaluate(()=>document.fonts.ready);
  const fontCount=await printPage.evaluate(async()=>{return (await document.fonts.load('16px KaTeX_Main')).length;});expect(fontCount).toBeGreaterThan(0);
  await expect(printPage.locator('.katex')).toBeVisible();
  await printPage.screenshot({path:'.omx/artifacts/md-editor-print.png'});await context.setOffline(false);
});

test('heading links navigate to deterministic Korean anchors',async({page})=>{
  await load(page,'[이동](#마지막-제목)\n\n'+Array.from({length:22},()=>('중간 문장입니다. '.repeat(8))).join('\n\n')+'\n\n## 마지막 제목\n\n도착');
  await expect(page.locator('#preview h2')).toHaveAttribute('id','마지막-제목');
  await page.locator('#preview a').click();await page.waitForTimeout(250);
  expect(await page.locator('#preview-scroll').evaluate(el=>el.scrollTop)).toBeGreaterThan(500);
});
