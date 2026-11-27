#!/usr/bin/env node
// Builds every Foliquo brand asset from one master mark: "Glasblätter", two overlapping pages
// (original and translation). Community, the workspace's edition, uses translucent glass gradients;
// Standard uses flat fills. Run: node scripts/build-brand.mjs
import sharp from 'sharp';
import {mkdir,readFile,readdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';

const root=fileURLToPath(new URL('../',import.meta.url));
const EDITIONS=['standard','community'];
const INK='#0F1115',DARK='#0B0E12',TILE_DARK='#151922';
const PALETTE={blueLight:'#7FB2FF',blue:'#2F6BFF',violetLight:'#C4A6FF',violet:'#7C3AED'};

// Geometry in a 400 × 400 box. The back page tilts left, the front page right; lines mark the front page as text.
const BACK={x:50,y:50,width:200,height:262,rx:50,rotate:'-9 150 181'};
const FRONT={x:150,y:88,width:200,height:262,rx:50,rotate:'7 250 219'};
const LINES='M194 169h100M194 212h100M194 256h62';

function defs(edition){
 if(edition!=='community')return '';
 return `<defs><linearGradient id="fq-back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PALETTE.blueLight}"/><stop offset="1" stop-color="${PALETTE.blue}"/></linearGradient><linearGradient id="fq-front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PALETTE.violetLight}"/><stop offset="1" stop-color="${PALETTE.violet}"/></linearGradient></defs>`;
}
const page=(shape,fill,opacity=1)=>`<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.rx}" transform="rotate(${shape.rotate})" fill="${fill}"${opacity<1?` fill-opacity="${opacity}"`:''}/>`;
// kind: color | inverse | black | white. Lines are left out of monochrome marks and tiny favicons.
function mark(edition,kind,{lines=true}={}){
 const glass=edition==='community';
 if(kind==='black'||kind==='white'){const fill=kind==='black'?INK:'#FFFFFF';return page(BACK,fill)+page(FRONT,fill,.55);}
 const back=glass?'url(#fq-back)':PALETTE.blue,front=glass?'url(#fq-front)':PALETTE.violet;
 return defs(edition)+page(BACK,back)+page(FRONT,front,glass?.78:.86)+(lines?`<path d="${LINES}" fill="none" stroke="#FFFFFF" stroke-opacity=".92" stroke-width="22" stroke-linecap="round" transform="rotate(${FRONT.rotate})"/>`:'');
}
const label=edition=>edition==='community'?'Community':'Standard';
const svg=(viewBox,title,desc,body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}"><title>${title}</title><desc>${desc}</desc>${body}</svg>\n`;
const DESC='Zwei überlappende Blätter: Original und Übersetzung';
function icon(edition,kind,options){return svg('0 0 400 400',`foliquo ${label(edition)} ${kind} icon`,DESC,mark(edition,kind,options));}
function onDark(edition){return svg('0 0 400 400',`foliquo ${label(edition)} on dark`,DESC,`<rect width="400" height="400" fill="${DARK}"/>${mark(edition,'inverse')}`);}
function appIcon(edition,theme){
 const tile=theme==='dark'?`<rect x="16" y="16" width="368" height="368" rx="82" fill="${TILE_DARK}" stroke="#242B36" stroke-width="2"/>`:`<rect x="16" y="16" width="368" height="368" rx="82" fill="#FFFFFF" stroke="#E5E9EF" stroke-width="2"/>`;
 return svg('0 0 400 400',`foliquo ${label(edition)} app icon ${theme}`,'App-Kachel mit deckendem Hintergrund',`${tile}<g transform="translate(46,46) scale(.77)">${mark(edition,theme==='dark'?'inverse':'color')}</g>`);
}
function wordmark(edition,theme){
 const dark=theme!=='light',backdrop=theme==='dark-background'?`<rect width="1150" height="320" fill="${DARK}"/>`:'',name=theme==='dark-background'?'dark backdrop':theme;
 return svg('0 0 1150 320',`foliquo ${label(edition)} horizontal ${name}`,'Wortmarke in Manrope Bold; Schrift wird extern geladen',`${backdrop}<g transform="translate(8,8) scale(.76)">${mark(edition,dark?'inverse':'color')}</g><text x="320" y="225" fill="${dark?'#FFFFFF':INK}" font-family="Manrope, sans-serif" font-size="173" font-weight="700" letter-spacing="-8.65">foliquo</text>`);
}
function sources(edition){
 return {
  'icon-color':icon(edition,'color'),'icon-inverse':icon(edition,'inverse'),'icon-black':icon(edition,'black'),'icon-white':icon(edition,'white'),
  'icon-on-dark-background':onDark(edition),'app-icon-light':appIcon(edition,'light'),'app-icon-dark':appIcon(edition,'dark'),
  'wordmark-light':wordmark(edition,'light'),'wordmark-dark':wordmark(edition,'dark'),'wordmark-dark-background':wordmark(edition,'dark-background')
 };
}

async function renderIcon(source,size){return sharp(Buffer.from(source),{density:Math.max(72,Math.ceil(72*size/400*2))}).resize(size,size).png({compressionLevel:9}).toBuffer();}
// Wordmarks carry live text, so they are rendered by Chromium with the bundled Manrope.
async function renderWordmarks(jobs){
 if(!jobs.length)return new Map();
 const {chromium}=await import('playwright');const font=(await readFile(join(root,'dist/brand/fonts/manrope-latin-wght-normal.woff2'))).toString('base64');
 const browser=await chromium.launch(),results=new Map();
 try{for(const job of jobs){const height=Math.round(job.width*320/1150),page=await browser.newPage({viewport:{width:job.width,height},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><style>@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:200 800}html,body{margin:0;background:transparent}svg{display:block;width:${job.width}px;height:${height}px}</style>${job.source}`);
  await page.evaluate(()=>document.fonts.ready);results.set(job.key,await page.screenshot({omitBackground:true,clip:{x:0,y:0,width:job.width,height}}));await page.close();}}
 finally{await browser.close();}
 return results;
}
function ico(images){
 const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
 images.forEach(({size,data},index)=>{const at=6+index*16;header.writeUInt8(size>=256?0:size,at);header.writeUInt8(size>=256?0:size,at+1);header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(data.length,at+8);header.writeUInt32LE(offset,at+12);offset+=data.length;});
 return Buffer.concat([header,...images.map(image=>image.data)]);
}
function tokens(edition,previous={}){
 return {...previous,name:'foliquo',edition,type:{family:'Manrope',fontWeight:700,letterSpacing:'-0.05em',wordmark:'foliquo'},
  colors:{ink:INK,accent:PALETTE.blue,accentSecondary:PALETTE.violet,white:'#FFFFFF',darkSurface:DARK},
  clearSpace:{icon:'25% of icon width',wordmark:'25% of icon height'},
  symbol:{name:'Glasblätter',meaning:'Two overlapping pages: the original and its translation',viewBox:'0 0 400 400',back:BACK,front:FRONT,lines:LINES,
   style:edition==='community'?`translucent glass: back ${PALETTE.blueLight}→${PALETTE.blue}, front ${PALETTE.violetLight}→${PALETTE.violet} at 78% opacity`:`flat: back ${PALETTE.blue}, front ${PALETTE.violet} at 86% opacity`}};
}

async function writeEdition(edition,targets,wordmarkPngs){
 const svgs=sources(edition);
 for(const base of targets){
  await mkdir(join(base,'svg'),{recursive:true});await mkdir(join(base,'png'),{recursive:true});await mkdir(join(base,'favicons'),{recursive:true});
  for(const [name,source] of Object.entries(svgs))await writeFile(join(base,'svg',`${name}.svg`),source);
  for(const file of await readdir(join(base,'png'))){
   const match=file.match(/^(.+)-(\d+)\.png$/);if(!match||!svgs[match[1]])continue;const [,name,size]=match;
   const kind=name.slice(5),data=name.startsWith('wordmark')?wordmarkPngs.get(`${edition}:${name}:${size}`):await renderIcon(['color','inverse'].includes(kind)&&+size<=32?icon(edition,kind,{lines:false}):svgs[name],+size);
   if(data)await writeFile(join(base,'png',file),data);
  }
  const small=size=>renderIcon(size<=32?icon(edition,'color',{lines:false}):svgs['icon-color'],size);
  for(const size of [16,32,48,64])await writeFile(join(base,'favicons',`favicon-${size}.png`),await small(size));
  for(const size of [192,512])await writeFile(join(base,'favicons',`android-chrome-${size}.png`),await renderIcon(svgs['app-icon-light'],size));
  await writeFile(join(base,'favicons','apple-touch-icon.png'),await renderIcon(svgs['app-icon-light'],180));
  await writeFile(join(base,'favicons','favicon.ico'),ico(await Promise.all([16,32,48,256].map(async size=>({size,data:await small(size)})))));
  const tokenFile=join(base,'brand-tokens.json'),previous=existsSync(tokenFile)?JSON.parse(await readFile(tokenFile,'utf8')):{};
  await writeFile(tokenFile,JSON.stringify(tokens(edition,previous),null,2)+'\n');
 }
}

async function main(){
 const jobs=[];
 for(const edition of EDITIONS)for(const base of [join(root,'brand',edition),join(root,'dist/brand',edition)])if(existsSync(join(base,'png')))for(const file of await readdir(join(base,'png'))){const match=file.match(/^(wordmark-[a-z-]+)-(\d+)\.png$/);if(match&&!jobs.some(job=>job.key===`${edition}:${match[1]}:${match[2]}`))jobs.push({key:`${edition}:${match[1]}:${match[2]}`,width:+match[2],source:sources(edition)[match[1]]});}
 for(const theme of ['light','dark'])jobs.push({key:`demo:${theme}`,width:1150,source:sources('community')[`wordmark-${theme}`]});
 const wordmarkPngs=await renderWordmarks(jobs);
 for(const edition of EDITIONS)await writeEdition(edition,[join(root,'brand',edition),join(root,'dist/brand',edition)],wordmarkPngs);

 // The browser logo component inlines the four symbol variants of both editions.
 const logoPath=join(root,'dist/brand/foliquo-logo.js'),logo=await readFile(logoPath,'utf8');
 const symbols=Object.fromEntries(EDITIONS.map(edition=>[edition,Object.fromEntries(['color','inverse','black','white'].map(kind=>[kind,icon(edition,kind).trim()]))]));
 const start=logo.indexOf('const symbols='),end=logo.indexOf('}};',start)+3;
 await writeFile(logoPath,logo.slice(0,start)+'const symbols='+JSON.stringify(symbols)+';'+logo.slice(end));
 const manifestPath=join(root,'dist/brand/manifest.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 for(const edition of EDITIONS)if(manifest.editions?.[edition])manifest.editions[edition].tokens=tokens(edition,manifest.editions[edition].tokens);
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');

 // Demo, documentation and desktop icons.
 await writeFile(join(root,'dist/demo/assets/foliquo-icon.svg'),icon('community','color'));
 await writeFile(join(root,'dist/demo/assets/foliquo-wordmark-light.png'),wordmarkPngs.get('demo:light'));
 await writeFile(join(root,'dist/demo/assets/foliquo-wordmark-dark.png'),wordmarkPngs.get('demo:dark'));
 await writeFile(join(root,'docs/images/foliquo-mark.svg'),icon('community','color'));
 const icons=join(root,'desktop/src-tauri/icons'),source=join(tmpdir(),'foliquo-app-icon-1024.png'),out=join(tmpdir(),'foliquo-tauri-icons');
 await writeFile(source,await renderIcon(sources('community')['app-icon-light'],1024));await rm(out,{recursive:true,force:true});
 const tauri=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['tauri','icon',source,'-o',out],{cwd:join(root,'desktop'),stdio:'inherit'});
 if(tauri.status===0)for(const file of ['icon.png','icon.ico','icon.icns'])await copyFile(join(out,file),join(icons,file));
 else console.warn('Tauri icon generation failed; desktop icons were left unchanged.');
 console.log(`Brand assets written (${jobs.length} wordmark renders).`);
}
await main();
