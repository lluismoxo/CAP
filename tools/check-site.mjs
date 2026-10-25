import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
const root=new URL('../dist/',import.meta.url).pathname;
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const html=files(root).filter(f=>f.endsWith('.html')&&!path.basename(f).startsWith('google'));
const get=(n,a)=>n.attrs?.find(x=>x.name===a)?.value;
function walk(n,fn){fn(n);for(const c of n.childNodes||[])walk(c,fn);}
const parsed=new Map(html.map(file=>{const nodes=[];walk(parse(fs.readFileSync(file,'utf8')),n=>nodes.push(n));return [file,nodes];}));
let count=0;const issues=[];
function check(value,message){count++;if(!value)issues.push(message);}
for(const [file,nodes] of parsed){
 const rel=path.relative(root,file),is404=rel.endsWith('404.html'),tag=t=>nodes.filter(n=>n.tagName===t);
 check(tag('h1').length===1,`${rel}: exactly one h1`);
 check(tag('title').length===1&&tag('title')[0].childNodes.some(n=>n.value?.length),`${rel}: title`);
 check(tag('meta').filter(n=>get(n,'name')==='description'&&get(n,'content')?.length>20).length===1,`${rel}: description`);
 check(tag('html')[0]&&['es','en','fr','it','de','pt'].includes(get(tag('html')[0],'lang')),`${rel}: language`);
 const canonical=tag('link').filter(n=>get(n,'rel')==='canonical');
 check(is404?canonical.length===0:canonical.length===1,`${rel}: canonical`);
 if(!is404)check(tag('link').filter(n=>get(n,'rel')==='alternate'&&get(n,'hreflang')).length===7,`${rel}: six languages and x-default`);
 for(const script of tag('script')){
  check(!!get(script,'src')||get(script,'type')==='application/ld+json',`${rel}: executable inline script`);
  if(get(script,'type')==='application/ld+json'){try{JSON.parse(script.childNodes.map(n=>n.value||'').join(''));}catch{issues.push(`${rel}: invalid JSON-LD`);}}
 }
 for(const image of tag('img')){check(get(image,'alt')!==undefined,`${rel}: missing image alt`);check(Number(get(image,'width'))>0&&Number(get(image,'height'))>0,`${rel}: missing image dimensions ${get(image,'src')}`);}
 check(!tag('video').some(n=>get(n,'autoplay')!==undefined||get(n,'preload')!=='none'),`${rel}: eager video`);
 for(const n of nodes){
  for(const a of n.attrs||[]){
   check(!/^on/i.test(a.name),`${rel}: event attribute`);
   if(!['href','src','poster','data-src'].includes(a.name)||!a.value||/^(https?:|mailto:|tel:|data:)/.test(a.value))continue;
   const u=new URL(a.value,'https://capconsultor.eu/'+rel);let target=path.join(root,decodeURI(u.pathname));
   if(u.pathname==='/')target=path.join(root,'index.html');else if(/^\/(en|fr|it|de|pt)\/?$/.test(u.pathname))target=path.join(root,u.pathname,'index.html');
   check(fs.existsSync(target),`${rel}: missing resource ${a.value}`);
   if(u.hash&&parsed.has(target)){const id=decodeURIComponent(u.hash.slice(1));check(parsed.get(target).some(x=>get(x,'id')===id),`${rel}: missing anchor ${a.value}`);}
  }
 }
 if(/(?:privacy|legal-notice|cookies)\.html$/.test(rel)){const text=nodes.filter(n=>n.nodeName==='#text').map(n=>n.value).join(' ');check(!/Lluís Moxó|GitHub Pages|Fable 5/.test(text),`${rel}: obsolete legal identity/provider`);}
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');check((sitemap.match(/<loc>/g)||[]).length===60,'sitemap: 60 canonical URLs');
const client=files(path.join(root,'assets')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(f,'utf8')).join('\n');
check(!/sb_secret_|service_role.*eyJ|sb_publishable_|\/rest\/v1\/clientes_web/.test(client),'database credentials/direct writes in client');
console.log(`${count} assertions across ${html.length} HTML pages; ${issues.length} issues.`);
if(issues.length){console.error([...new Set(issues)].slice(0,80).join('\n'));process.exit(1);}
