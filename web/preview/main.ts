import '../src/styles.css';
import './preview.css';
import { renderMarkdown, renderDiagrams } from '../src/markdown';

type PreviewRequest = {text:string; name:string; requestId:string|number; baseURL?:string};
// Separate bridge: the Finder page has no editing, clipboard, save, or document commands.
// Assign through a structural type so the editor and preview can typecheck independently.
const bridgeWindow=window as unknown as {
  webkit?:{messageHandlers:{preview:{postMessage:(message:unknown)=>void}}};
  MDPreview:{load:(request:PreviewRequest)=>void};
};
const article=document.getElementById('preview')!;
const darkMode=window.matchMedia('(prefers-color-scheme: dark)');
let generation=0;
let latest:PreviewRequest|undefined;
const pendingImages=new Set<()=>void>();
function post(message:unknown){bridgeWindow.webkit?.messageHandlers.preview.postMessage(message);}
function applyTheme(){document.body.classList.toggle('dark',darkMode.matches);}
function prepareImages(container:HTMLElement,baseURL?:string):Promise<void>{
  return Promise.all([...container.querySelectorAll<HTMLImageElement>('img')].map(image=>{
    const source=image.getAttribute('src')||'';
    // Only embedded images and explicitly brokered document-relative images can load.
    // Strip remote/absolute file sources rather than leaving a request to fail in Quick Look.
    const embedded=/^data:image\//i.test(source);
    if(!embedded&&(!source||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)||!baseURL?.startsWith('mdpreview-image://document/'))){
      image.removeAttribute('src');image.alt=image.alt||'이미지';return Promise.resolve();
    }
    return new Promise<void>(resolve=>{
      let timer:ReturnType<typeof setTimeout>;
      const finish=()=>{clearTimeout(timer);image.removeEventListener('load',finish);image.removeEventListener('error',finish);pendingImages.delete(finish);resolve();};
      pendingImages.add(finish);
      image.addEventListener('load',finish,{once:true});image.addEventListener('error',finish,{once:true});
      timer=setTimeout(finish,2500);
      try{if(!embedded)image.src=new URL(source.replace(/^\//,''),baseURL).href;}catch{image.removeAttribute('src');finish();}
      if(image.complete)finish();
    });
  })).then(()=>{});
}
async function render(request:PreviewRequest){
  const current=++generation;
  for(const cancel of [...pendingImages])cancel();
  article.setAttribute('aria-busy','true');article.dataset.renderState='loading';
  try{
    if(typeof request.text!=='string')throw new Error('문서 내용을 읽을 수 없습니다.');
    document.title=request.name||'Mr. Markdown 미리보기';
    applyTheme();
    // Keep the old generation detached. A slow Mermaid render cannot overwrite a newer file.
    const content=document.createElement('div');
    content.innerHTML=renderMarkdown(request.text);
    if(!content.childNodes.length){const empty=document.createElement('p');empty.className='preview-empty';empty.textContent='빈 마크다운 문서입니다.';content.append(empty);}
    const images=prepareImages(content,request.baseURL);
    article.replaceChildren(content);
    window.scrollTo(0,0);
    await Promise.all([renderDiagrams(content,darkMode.matches),images,document.fonts.ready]);
    await document.fonts.ready;
    if(current!==generation)return;
    article.setAttribute('aria-busy','false');article.dataset.renderState='ready';
    post({type:'rendered',requestId:request.requestId,loadedImages:[...content.querySelectorAll('img')].filter(image=>image.complete&&image.naturalWidth>0).length});
  }catch(error){
    if(current!==generation)return;
    const message=error instanceof Error?error.message:String(error);
    const paragraph=document.createElement('p');paragraph.className='preview-empty';paragraph.textContent=`미리보기를 표시할 수 없습니다: ${message}`;article.replaceChildren(paragraph);
    article.setAttribute('aria-busy','false');article.dataset.renderState='error';
    post({type:'error',requestId:request.requestId,message});
  }
}
bridgeWindow.MDPreview={load(request){latest=request;void render(request);}};
darkMode.addEventListener('change',()=>{applyTheme();if(latest)void render(latest);});
article.addEventListener('click',event=>{
  const anchor=(event.target as Element).closest<HTMLAnchorElement>('a');
  if(!anchor)return;
  event.preventDefault();
  const href=anchor.getAttribute('href')||'';
  if(!href.startsWith('#'))return;
  try{document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({block:'start'});}catch{/* malformed fragment remains inert */}
});
applyTheme();post({type:'ready'});
