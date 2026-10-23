import './styles.css';
import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { renderMarkdown, renderDiagrams } from './markdown';
import { interpolate } from './scroll';
import { formatSelection } from './format';

declare global {
  interface Window {
    webkit?: { messageHandlers: { native: { postMessage: (message: unknown) => void } } };
    MDEditor: { receive: (message: NativeMessage) => void; getText: () => string; isDirty: () => boolean; prepareClose: () => Promise<string>; printHTML: () => Promise<string>; editor: EditorView };
  }
}
type NativeMessage = {type:string; command?:string; text?:string; name?:string; baseURL?:string; fonts?:string[]; url?:string; alt?:string};
type Appearance = {font:string; size:number; dark:boolean};
type Settings = {editor:Appearance; preview:Appearance; inherit:boolean; lines:boolean; layout:'split'|'editor'|'preview'; split:number};
const $ = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
const native = !!window.webkit?.messageHandlers.native;
function post(message:unknown) { window.webkit?.messageHandlers.native.postMessage(message); }
const defaultSettings:Settings = {editor:{font:'Menlo',size:13,dark:false},preview:{font:'Apple SD Gothic Neo',size:14,dark:false},inherit:false,lines:true,layout:'split',split:50};
function loadSettings():Settings {
  try {
    const raw=JSON.parse(localStorage.getItem('mdeditor.settings.v1') || '{}');
    const appearance=(input:Partial<Appearance>|undefined,fallback:Appearance):Appearance=>({font:typeof input?.font==='string' ? input.font : fallback.font,size:typeof input?.size==='number' ? Math.max(10,Math.min(20,input.size)) : fallback.size,dark:typeof input?.dark==='boolean'?input.dark:false});
    return {editor:appearance(raw.editor,defaultSettings.editor),preview:appearance(raw.preview,defaultSettings.preview),inherit:raw.inherit===true,lines:raw.lines!==false,layout:['split','editor','preview'].includes(raw.layout)?raw.layout:'split',split:typeof raw.split==='number'?Math.max(25,Math.min(75,raw.split)):50};
  } catch { return structuredClone(defaultSettings); }
}
let settings=loadSettings();
let chromeDark:boolean|undefined;
function saveSettings(){try{localStorage.setItem('mdeditor.settings.v1',JSON.stringify(settings));}catch{/* private browser/local storage unavailable */}}
const welcome=`# 나의 마크다운 작업실

생각은 가볍게 쓰고, 문서는 단정하게 다듬으세요. **Mr. Markdown**는 왼쪽의 원문과 오른쪽의 미리보기를 함께 보여줍니다.

## 쓰는 일에 집중하기

문법은 그대로 보이면서 서식이 함께 표시됩니다. 글을 선택한 뒤 상단 도구를 누르거나 **⌘B**, *⌘I*로 빠르게 꾸밀 수 있습니다.

> 한 문장부터 시작하세요. 나머지는 자연스럽게 따라옵니다.

### 오늘의 체크리스트

- [x] 편집창과 미리보기를 나란히 열기
- [x] 내게 맞는 글꼴과 크기 고르기
- [ ] 첫 번째 문서 저장하기

## 익숙한 문법, 더 넓은 표현

| 표현 | 마크다운 | 활용 |
| :--- | :--- | :--- |
| 굵은 글씨 | **강조** | 중요한 문장 |
| 코드 | \`const idea = "hello"\` | 정확한 기록 |
| 할 일 | 체크리스트 | 작은 계획 |

### 코드도 편안하게

\`\`\`javascript
function writeSomething(idea) {
  return idea.trim() || "첫 문장을 써 보세요.";
}
\`\`\`

수식 $E = mc^2$부터 각주[^note]까지, 필요한 만큼 표현하세요.

---

글꼴과 테마는 각 창 위에서 바꿀 수 있습니다. 미리보기의 **편집창과 같음**을 선택하면 두 창의 설정이 함께 움직입니다.

[^note]: 모든 문서는 로컬 파일로 저장됩니다. 파일 메뉴에서 새 문서를 시작하거나 기존 파일을 열어 보세요.
`;
const lineCompartment=new Compartment(), themeCompartment=new Compartment();
const highlight=HighlightStyle.define([
  {tag:tags.heading1,color:'#277f7c',fontWeight:'700',fontSize:'1.45em'},
  {tag:tags.heading2,color:'#277f7c',fontWeight:'700',fontSize:'1.25em'},
  {tag:[tags.heading3,tags.heading4,tags.heading5,tags.heading6],color:'#358780',fontWeight:'650',fontSize:'1.1em'},
  {tag:tags.strong,color:'#b16c3e',fontWeight:'700'},
  {tag:tags.emphasis,fontStyle:'italic',color:'#7f6c98'},
  {tag:tags.strikethrough,textDecoration:'line-through'},
  {tag:[tags.monospace,tags.processingInstruction],color:'#87928d'},
  {tag:[tags.url,tags.link],color:'#398cb1',textDecoration:'underline',textUnderlineOffset:'3px'},
  {tag:tags.quote,color:'#7b8f82',fontStyle:'italic'},
  {tag:tags.list,color:'#4789a8'},
  {tag:tags.meta,color:'#8da29b'},
]);
const darkHighlight=HighlightStyle.define([
  {tag:tags.heading1,color:'#80c7c0',fontWeight:'700',fontSize:'1.45em'},
  {tag:tags.heading2,color:'#80c7c0',fontWeight:'700',fontSize:'1.25em'},
  {tag:[tags.heading3,tags.heading4,tags.heading5,tags.heading6],color:'#84c5ba',fontWeight:'650',fontSize:'1.1em'},
  {tag:tags.strong,color:'#dfa271',fontWeight:'700'},
  {tag:tags.emphasis,fontStyle:'italic',color:'#c6acd7'},
  {tag:tags.strikethrough,textDecoration:'line-through'},
  {tag:[tags.monospace,tags.processingInstruction],color:'#a1aba7'},
  {tag:[tags.url,tags.link],color:'#8cc1d6',textDecoration:'underline'},
  {tag:tags.quote,color:'#a0b4a5',fontStyle:'italic'},
  {tag:tags.list,color:'#82b1ca'},
  {tag:tags.meta,color:'#8da29b'},
]);
function editorTheme(dark:boolean){return [EditorView.theme({'&':{backgroundColor:'var(--surface)',color:'var(--text)'},'.cm-content':{fontFamily:'var(--editor-font)'},'.cm-scroller':{fontFamily:'var(--editor-font)'}},{dark}),syntaxHighlighting(dark?darkHighlight:highlight)];}
let savedText=native?'':welcome, fileName=native?'제목 없음.md':'시작하기.md', baseURL='';
let isLoading=false, renderTimer:ReturnType<typeof setTimeout>|undefined, renderGeneration=0;
let syncFrame=0, suppressFrom:'editor'|'preview'|null=null, releaseFrame=0;
const view=new EditorView({
  state:EditorState.create({doc:native?'':welcome,extensions:editorExtensions()}),parent:$('editor'),
});
const scroller=$('preview-scroll'), preview=$('preview');
function format(kind:string){
  if(settings.layout==='preview'){settings.layout='split';applySettings();}
  const selection=view.state.selection.main;
  const result=formatSelection(view.state.doc.toString(),selection.from,selection.to,kind);
  view.dispatch({changes:{from:result.from,to:result.to,insert:result.insert},selection:EditorSelection.single(result.selectionFrom,result.selectionTo),scrollIntoView:true,userEvent:'input'});
  view.focus();$('selection-menu').hidden=true;
}
function updateStatus(){
  const selection=view.state.selection.main, line=view.state.doc.lineAt(selection.head);
  $('file-name').textContent=fileName;
  $('dirty-status').textContent=view.state.doc.toString()===savedText?'':'수정됨';
  $('cursor-status').textContent=`줄 ${line.number}, 열 ${selection.head-line.from+1}`;
  $('word-count').textContent=`${view.state.doc.toString().trim().split(/\s+/u).filter(Boolean).length.toLocaleString('ko-KR')} 단어`;
  document.title=`${view.state.doc.toString()===savedText?'':'● '}${fileName} — Mr. Markdown`;
}
function resolveImages(){
  preview.querySelectorAll<HTMLImageElement>('img').forEach(img=>{
    const source=img.getAttribute('src') || '';
    if(baseURL && source && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)){
      try{img.src=new URL(source.replace(/^\//,''),baseURL).href;}catch{/* invalid path remains sanitized */}
    }
    img.addEventListener('load',()=>requestSync('editor'),{once:true});
  });
}
function queueRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>void render(),90);}
async function render(){
  const generation=++renderGeneration;
  const top=scroller.scrollTop;
  try{
    preview.innerHTML=renderMarkdown(view.state.doc.toString());
    resolveImages();
    scroller.scrollTop=top;
    await renderDiagrams(preview,effectivePreview().dark);
    if(generation!==renderGeneration)return;
    requestSync('editor');
  }catch(error){
    const message=document.createElement('p');message.className='diagram-error';message.textContent=`미리보기를 표시할 수 없습니다: ${error instanceof Error?error.message:String(error)}`;preview.replaceChildren(message);
  }
}
function effectivePreview(){return settings.inherit?settings.editor:settings.preview;}
function fontCSS(font:string){return `${JSON.stringify(font)}, "Apple SD Gothic Neo", sans-serif`;}
function applySettings(){
  const p=effectivePreview();
  const dark=settings.layout==='preview'?p.dark:settings.editor.dark;
  document.documentElement.dataset.chromeTheme=dark?'dark':'light';
  if(chromeDark!==dark){chromeDark=dark;post({type:'appearance',dark});}
  $('editor-pane').classList.toggle('dark',settings.editor.dark);$('preview-pane').classList.toggle('dark',p.dark);
  $('editor-pane').style.setProperty('--editor-font',fontCSS(settings.editor.font));$('editor-pane').style.setProperty('--editor-size',`${settings.editor.size}pt`);
  $('preview-pane').style.setProperty('--preview-font',fontCSS(p.font));$('preview-pane').style.setProperty('--preview-size',`${p.size}pt`);
  for(const side of ['editor','preview'] as const){
    const appearance=side==='preview'?p:settings.editor;
    $<HTMLSelectElement>(`${side}-font`).value=appearance.font;
    $<HTMLInputElement>(`${side}-size`).value=String(appearance.size);
    $(`${side}-size-value`).textContent=`${appearance.size} pt`;
    $<HTMLInputElement>(`${side}-dark`).checked=appearance.dark;
  }
  $<HTMLInputElement>('preview-inherit').checked=settings.inherit;
  for(const id of ['preview-font','preview-size','preview-dark'])($<HTMLInputElement>(id)).disabled=settings.inherit;
  view.dispatch({effects:[themeCompartment.reconfigure(editorTheme(settings.editor.dark)),lineCompartment.reconfigure(settings.lines?lineNumbers():[])]});
  $('toggle-lines').setAttribute('aria-pressed',String(settings.lines));
  const workspace=document.querySelector<HTMLElement>('.workspace')!;
  workspace.classList.toggle('editor-only',settings.layout==='editor');workspace.classList.toggle('preview-only',settings.layout==='preview');
  workspace.style.setProperty('--split',`${settings.split}%`);$('splitter').setAttribute('aria-valuenow',String(Math.round(settings.split)));
  post({type:'viewState',lines:settings.lines,editor:settings.layout!=='preview',preview:settings.layout!=='editor'});
  saveSettings(); view.requestMeasure();requestSync('editor');
}
let fonts=['Apple SD Gothic Neo','Menlo','Monaco','SF Mono','Helvetica Neue','Avenir Next','Georgia','Times New Roman','Courier New'];
function setFonts(installed?:string[]){
  if(installed?.length)fonts=[...new Set([...fonts,...installed])].sort((a,b)=>a.localeCompare(b,'ko'));
  for(const side of ['editor','preview'] as const){
    const select=$<HTMLSelectElement>(`${side}-font`);
    select.replaceChildren(...[...new Set([settings[side].font,...fonts])].map(font=>{const option=document.createElement('option');option.value=font;option.textContent=font;return option;}));
  }
}
for(const side of ['editor','preview'] as const){
  $(`${side}-font`).addEventListener('change',event=>{settings[side].font=(event.target as HTMLSelectElement).value;applySettings();});
  $(`${side}-size`).addEventListener('input',event=>{settings[side].size=Number((event.target as HTMLInputElement).value);applySettings();});
  $(`${side}-dark`).addEventListener('change',event=>{settings[side].dark=(event.target as HTMLInputElement).checked;applySettings();void render();});
}
$('preview-inherit').addEventListener('change',event=>{settings.inherit=(event.target as HTMLInputElement).checked;applySettings();void render();});
$('toggle-lines').addEventListener('click',()=>{settings.lines=!settings.lines;applySettings();});
document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button=>{
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.addEventListener('click',()=>format(button.dataset.format!));
});
$('insert-image').addEventListener('click',()=>{if(native)post({type:'chooseImage'});else format('image');});
$('layout-button').addEventListener('click',()=>{$('layout-menu').hidden=!$('layout-menu').hidden;});
document.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach(button=>button.addEventListener('click',()=>{settings.layout=button.dataset.layout as Settings['layout'];applySettings();$('layout-menu').hidden=true;}));
document.addEventListener('click',event=>{if(!($('layout-menu').contains(event.target as Node)||$('layout-button').contains(event.target as Node)))$('layout-menu').hidden=true;});
function scheduleSelectionMenu(){
  requestAnimationFrame(()=>{
    const selection=view.state.selection.main, menu=$('selection-menu');
    if(selection.empty||!view.hasFocus||settings.layout==='preview'){menu.hidden=true;return;}
    const coords=view.coordsAtPos(selection.to), sourceRect=$('editor').getBoundingClientRect();
    if(!coords||coords.top<sourceRect.top||coords.bottom>sourceRect.bottom){menu.hidden=true;return;}
    menu.hidden=false;menu.style.left=`${Math.max(sourceRect.left+8,Math.min(coords.left-66,sourceRect.right-145))}px`;menu.style.top=`${Math.max(sourceRect.top+5,coords.top-42)}px`;
  });
}
view.contentDOM.addEventListener('keyup',scheduleSelectionMenu);view.contentDOM.addEventListener('mouseup',scheduleSelectionMenu);
view.contentDOM.addEventListener('blur',()=>setTimeout(()=>{$('selection-menu').hidden=true;},130));
view.scrollDOM.addEventListener('scroll',()=>{$('selection-menu').hidden=true;requestSync('editor');},{passive:true});
scroller.addEventListener('scroll',()=>requestSync('preview'),{passive:true});
scroller.addEventListener('click',event=>{
  const link=(event.target as Element).closest<HTMLAnchorElement>('a');
  if(!link)return;
  const href=link.getAttribute('href')||'';
  if(href.startsWith('#')){
    event.preventDefault();let target:HTMLElement|null=null;try{target=preview.querySelector<HTMLElement>(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);}catch{/* malformed fragment */}target?.scrollIntoView({block:'center'});return;
  }
  event.preventDefault();
  if(/^(https?:|mailto:)/i.test(href)){if(native)post({type:'openLink',url:href});else window.open(href,'_blank','noopener,noreferrer');}
});
// Build a monotonic correspondence from Markdown source lines to rendered block positions.
// Use both opening and closing edges, so long code blocks and paragraphs interpolate smoothly.
function scrollAnchors(from:'editor'|'preview'){
  const source=view.scrollDOM, target=scroller;
  const offset=view.documentTop-source.getBoundingClientRect().top+source.scrollTop;
  const previewOrigin=preview.getBoundingClientRect().top-target.getBoundingClientRect().top+target.scrollTop;
  const lineY=(line:number)=>{
    const n=Math.max(1,Math.min(view.state.doc.lines,line));
    const block=view.lineBlockAt(view.state.doc.line(n).from);
    return offset+(line>view.state.doc.lines?block.bottom:block.top);
  };
  const points=[{line:1,preview:previewOrigin}];
  for(const element of preview.querySelectorAll<HTMLElement>('[data-source-line]')){
    const start=Number(element.dataset.sourceLine),end=Number(element.dataset.sourceEndLine||start);
    if(!Number.isFinite(start)||start<1)continue;
    const rect=element.getBoundingClientRect();
    if(!rect.height)continue;
    const top=rect.top-target.getBoundingClientRect().top+target.scrollTop;
    points.push({line:start,preview:top},{line:end+1,preview:top+rect.height});
  }
  points.sort((a,b)=>a.line-b.line||a.preview-b.preview);
  const paired:{editor:number;preview:number}[]=[];
  let lastLine=0,lastY=-1;
  for(const point of points){
    if(point.line===lastLine||point.preview<lastY)continue;
    paired.push({editor:lineY(point.line),preview:point.preview});lastLine=point.line;lastY=point.preview;
  }
  const a=from==='editor'?source:target,b=from==='editor'?target:source;
  const aMin=a.clientHeight/2,bMin=b.clientHeight/2,aMax=a.scrollHeight-a.clientHeight/2,bMax=b.scrollHeight-b.clientHeight/2;
  const mapped=paired.map(p=>({source:p[from],target:p[from==='editor'?'preview':'editor']})).filter(p=>p.source>aMin&&p.source<aMax&&p.target>bMin&&p.target<bMax);
  return [{source:aMin,target:bMin},...mapped,{source:Math.max(aMin,aMax),target:Math.max(bMin,bMax)}];
}
function requestSync(from:'editor'|'preview'){
  if(settings.layout!=='split'||suppressFrom===from)return;
  cancelAnimationFrame(syncFrame);
  syncFrame=requestAnimationFrame(()=>{
    const source=from==='editor'?view.scrollDOM:scroller,target=from==='editor'?scroller:view.scrollDOM;
    if(source.scrollHeight<=source.clientHeight+1)return;
    const center=source.scrollTop+source.clientHeight/2;
    const top=interpolate(center,scrollAnchors(from))-target.clientHeight/2;
    suppressFrom=from==='editor'?'preview':'editor';
    target.scrollTop=Math.max(0,Math.min(target.scrollHeight-target.clientHeight,top));
    cancelAnimationFrame(releaseFrame);releaseFrame=requestAnimationFrame(()=>{releaseFrame=requestAnimationFrame(()=>{suppressFrom=null;});});
  });
}
new ResizeObserver(()=>{view.requestMeasure();requestSync('editor');}).observe($('app'));
const splitter=$('splitter');
splitter.addEventListener('pointerdown',event=>{splitter.setPointerCapture(event.pointerId);splitter.classList.add('dragging');});
splitter.addEventListener('pointermove',event=>{
  if(!splitter.hasPointerCapture(event.pointerId))return;
  const rect=document.querySelector('.workspace')!.getBoundingClientRect();settings.split=Math.max(25,Math.min(75,(event.clientX-rect.left)/rect.width*100));applySettings();
});
splitter.addEventListener('pointerup',event=>{splitter.releasePointerCapture(event.pointerId);splitter.classList.remove('dragging');});
splitter.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();settings.split=Math.max(25,Math.min(75,settings.split+(event.key==='ArrowRight'?2:-2)));applySettings();}});
function toast(message:string){$('toast').textContent=message;$('toast').hidden=false;setTimeout(()=>{$('toast').hidden=true;},3000);}
function replaceDocument(text:string,name:string,base?:string){
  isLoading=true;clearTimeout(renderTimer);savedText=text;fileName=name;baseURL=base||'';
  // A new EditorState resets history; undo must never restore the previously open file.
  view.setState(EditorState.create({doc:text,extensions:editorExtensions()}));
  view.scrollDOM.scrollTop=0;scroller.scrollTop=0;isLoading=false;applySettings();updateStatus();void render();
}
// Recreate configuration for a new document, without carrying its previous undo history.
function editorExtensions(){
  return [history(),drawSelection(),highlightActiveLine(),highlightActiveLineGutter(),indentOnInput(),bracketMatching(),markdown(),EditorView.lineWrapping,search({top:true}),placeholder('첫 문장을 써 보세요…'),lineCompartment.of(settings.lines?lineNumbers():[]),themeCompartment.of(editorTheme(settings.editor.dark)),EditorView.contentAttributes.of({'aria-label':'마크다운 원문 편집','spellcheck':'false','autocorrect':'off','autocapitalize':'off'}),keymap.of([{key:'Mod-b',run:()=>{format('bold');return true;}},{key:'Mod-i',run:()=>{format('italic');return true;}},{key:'Mod-Shift-k',run:()=>{format('link');return true;}},...defaultKeymap,...historyKeymap,...searchKeymap,indentWithTab]),EditorView.updateListener.of(update=>{if(update.docChanged){if(!isLoading)post({type:'change',text:view.state.doc.toString()});queueRender();updateStatus();}if(update.selectionSet){updateStatus();scheduleSelectionMenu();}if(update.geometryChanged||update.viewportChanged)requestSync('editor');})];
}
function fieldCommand(command:string|undefined, text?:string):boolean {
  const active=document.activeElement;
  if(!(active instanceof HTMLInputElement)||!['text','search'].includes(active.type))return false;
  const start=active.selectionStart??0,end=active.selectionEnd??0;
  const set=(value:string)=>{active.setRangeText(value,start,end,'end');active.dispatchEvent(new Event('input',{bubbles:true}));};
  if(command==='selectAll'){active.select();return true;}
  if(command==='copy'||command==='cut'){
    const value=active.value.slice(start,end);
    if(native)post({type:'clipboard',text:value});else void navigator.clipboard.writeText(value);
    if(command==='cut')set('');return true;
  }
  if(command==='paste'){
    if(text!==undefined)set(text);else void navigator.clipboard.readText().then(set).catch(()=>toast('⌘V로 붙여넣어 주세요.'));
    return true;
  }
  if(command==='undo'||command==='redo'){document.execCommand(command);return true;}
  return false;
}
function receive(message:NativeMessage){
  if(message.type==='load'){replaceDocument(message.text||'',message.name||'제목 없음.md',message.baseURL);return;}
  if(message.type==='saved'){savedText=message.text??view.state.doc.toString();fileName=message.name||fileName;baseURL=message.baseURL||baseURL;updateStatus();resolveImages();return;}
  if(message.type==='fonts'){setFonts(message.fonts);applySettings();return;}
  if(message.type!=='command')return;
  const command=message.command;
  if(fieldCommand(command,message.text))return;
  if(command==='undo')undo(view);else if(command==='redo')redo(view);
  else if(command==='find'||command==='replace'){
    if(settings.layout==='preview'){settings.layout='split';applySettings();}
    openSearchPanel(view);
    requestAnimationFrame(()=>{const input=view.dom.querySelector<HTMLInputElement>(command==='replace'?'input[name=replace]':'input[name=search]');input?.focus();});
  }else if(command==='selectAll'){view.dispatch({selection:{anchor:0,head:view.state.doc.length}});view.focus();}
  else if(command==='copy'||command==='cut'){
    const previewSelection=!view.hasFocus && (window.getSelection()?.toString()||'');
    const text=previewSelection||view.state.sliceDoc(view.state.selection.main.from,view.state.selection.main.to);
    if(native)post({type:'clipboard',text});else void navigator.clipboard.writeText(text);
    if(command==='cut'&&!previewSelection)view.dispatch(view.state.replaceSelection(''));
  }else if(command==='paste'){
    if(message.text!==undefined){view.dispatch(view.state.replaceSelection(message.text));view.focus();}
    else void navigator.clipboard.readText().then(text=>{view.dispatch(view.state.replaceSelection(text));view.focus();}).catch(()=>toast('⌘V로 붙여넣어 주세요.'));
  }else if(command==='toggleLines'){settings.lines=!settings.lines;applySettings();}
  else if(command==='toggleEditor'){settings.layout=settings.layout==='preview'?'split':'preview';applySettings();}
  else if(command==='togglePreview'){settings.layout=settings.layout==='editor'?'split':'editor';applySettings();}
  else if(command==='insertImage'){
    const alt=(message.alt||'이미지').replace(/[\[\]\\]/g,'');const url=message.url||'';
    if(!/^(data:image\/|mdeditor-resource:|https?:)/i.test(url))return;
    view.dispatch(view.state.replaceSelection(`![${alt}](<${url}>)`));view.focus();
  }else if(command==='print'){window.print();}
  else if(command==='bold'||command==='italic')format(command);
}
async function printHTML(){
  clearTimeout(renderTimer);await render();await document.fonts.ready;
  const styles=[...document.styleSheets].map(sheet=>{try{return [...sheet.cssRules].map(rule=>rule.cssText).join('\n');}catch{return '';}}).join('\n');
  const p=effectivePreview();
  const clone=preview.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-source-line]').forEach(el=>{el.removeAttribute('data-source-line');el.removeAttribute('data-source-end-line');});
  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>${fileName.replace(/[<>&"]/g,'')}</title><style>${styles}\n:root{--surface:white;--text:#111;--muted:#666;--pane-border:#ddd;--gutter:#f7f7f7;--code:#f4f4f4;--preview-font:${fontCSS(p.font)};--preview-size:${p.size}pt}body{overflow:visible;background:white;color:#111;margin:0}.markdown-body{padding:0;max-width:none}a{color:inherit}</style></head><body>${clone.outerHTML}</body></html>`;
}
window.MDEditor={receive,getText:()=>view.state.doc.toString(),isDirty:()=>view.state.doc.toString()!==savedText,prepareClose:async()=>{view.contentDOM.blur();await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,0));return view.state.doc.toString();},printHTML,editor:view};
setFonts();applySettings();updateStatus();void render();post({type:'ready'});
// Browser preview only: keep a draft through refresh without affecting native NSDocument saves.
if(!native){
  try{const draft=localStorage.getItem('mdeditor.browser-draft');if(draft!==null)replaceDocument(draft,'브라우저 임시 문서.md');}catch{/* unavailable storage */}
  window.addEventListener('beforeunload',()=>{try{localStorage.setItem('mdeditor.browser-draft',view.state.doc.toString());}catch{/* unavailable storage */}});
}
