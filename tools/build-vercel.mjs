import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse,parseFragment,serialize} from 'parse5';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'dist');
const langs=['es','en','fr','it','de','pt'],origin='https://capconsultor.eu';
const legal=JSON.parse(await readFile(path.join(root,'content/legal.json'),'utf8'));
const extra=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
const dimensions=JSON.parse(await readFile(path.join(root,'content/image-dimensions.json'),'utf8'));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const get=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;
function set(n,k,v){n.attrs??=[];const a=n.attrs.find(a=>a.name===k);if(a)a.value=v;else n.attrs.push({name:k,value:String(v)});}
function remove(n){const a=n.parentNode?.childNodes;if(a)a.splice(a.indexOf(n),1);}
function walk(n,fn){fn(n);for(const c of [...n.childNodes||[]])walk(c,fn);}
function nodes(n,test){const r=[];walk(n,x=>{if(test(x))r.push(x);});return r;}
function append(parent,html){const list=parseFragment(html).childNodes;list.forEach(n=>n.parentNode=parent);parent.childNodes.push(...list);}
function text(n){return n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');}
function pageUrl(file,lang){return origin+(lang==='es'?'':'/'+lang)+(file==='index.html'?(lang==='es'?'/':''):'/'+file);}
function translate(s,dict){const key=s.trim();return Object.hasOwn(dict,key)?s.replace(key,dict[key]):s;}
const names=(await readdir(root)).filter(f=>f.endsWith('.html')&&!f.startsWith('google')&&f!=='404.html');if(!names.includes('cookies.html'))names.push('cookies.html');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});await cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
const assetMap=new Map();
for(const folder of ['js','css'])for(const file of await readdir(path.join(root,'assets',folder))){
 const source='assets/'+folder+'/'+file,body=await readFile(path.join(root,source));const hash=createHash('sha256').update(body).digest('hex').slice(0,12);const target=`assets/build/${path.basename(file,path.extname(file))}.${hash}${path.extname(file)}`;
 // CSS font/image paths remain relative to assets/build, just as to assets/css.
 await mkdir(path.dirname(path.join(out,target)),{recursive:true});await writeFile(path.join(out,target),body);assetMap.set(source,'/'+target);
}
let generated=0;const sitemap=[];
for(const lang of langs){
 const dict=lang==='es'?{}:JSON.parse(await readFile(path.join(root,'assets/i18n',lang+'.json'),'utf8'));
 Object.assign(dict,extra.translations[lang]||{});
 for(const name of [...names,'404.html']){
  const legalKey={'privacy.html':'privacy','legal-notice.html':'legal','cookies.html':'cookies'}[name];
  // Do not publish a falsely-labelled translation of a legal page.
  if(legalKey&&!legal[lang])continue;
  const raw=await readFile(path.join(root,name==='cookies.html'?'privacy.html':name),'utf8');
  const doc=parse(raw);const head=nodes(doc,n=>n.tagName==='head')[0],body=nodes(doc,n=>n.tagName==='body')[0],html=nodes(doc,n=>n.tagName==='html')[0];set(html,'lang',lang);
  let main=nodes(doc,n=>n.tagName==='main')[0];
  if(!main){main=body;}
  if(legalKey){const [title,intro,sections]=legal[lang][legalKey];main.childNodes=[];append(main,`<article class="cap-legal"><h1>${escape(title)}</h1><p>${escape(intro)}</p>${sections.map(([h,p])=>`<section><h2>${escape(h)}</h2><p>${escape(p)}</p></section>`).join('')}<p><a href="${lang==='es'?'/':'/'+lang+'/'}privacy.html">${escape(legal[lang].privacy[0])}</a> · <a href="${lang==='es'?'/':'/'+lang+'/'}cookies.html">${escape(legal[lang].cookies[0])}</a></p></article>`);}
  const replace=extra.replace;
  walk(doc,n=>{
   if(n.nodeName==='#text'&&!['script','style'].includes(n.parentNode?.tagName)){
    const key=n.value.trim();if(Object.hasOwn(replace,key))n.value=n.value.replace(key,replace[key]);
    let parent=n.parentNode,insideMain=false;while(parent){if(parent===main)insideMain=true;parent=parent.parentNode;}if(!legalKey||!insideMain)n.value=translate(n.value,dict);
   }
   if(!n.tagName)return;
   for(const attr of n.attrs||[])if(['placeholder','aria-label','title','alt'].includes(attr.name))attr.value=translate(replace[attr.value]||attr.value,dict);
   if(n.tagName==='script'&&!get(n,'src'))remove(n);
   if(n.tagName==='meta'&&['description','og:title','og:description','twitter:title','twitter:description'].includes(get(n,'name')||get(n,'property')))set(n,'content',translate(replace[get(n,'content')]||get(n,'content'),dict));
   if(n.tagName==='link'&&['canonical','alternate','preload'].includes(get(n,'rel')))remove(n);
   if(n.tagName==='img'){
    const src=(get(n,'src')||'').replace(/^\.\//,'').split('?')[0];const dim=dimensions[src];if(dim){if(!get(n,'width'))set(n,'width',dim[0]);if(!get(n,'height'))set(n,'height',dim[1]);}
    set(n,'decoding','async');set(n,'loading',src.includes('cap-logo-mark')?'eager':'lazy');
    n.attrs=n.attrs.filter(a=>a.name!=='srcset');
   }
   if(n.tagName==='video'){
    n.attrs=n.attrs.filter(a=>a.name!=='autoplay');set(n,'preload','none');set(n,'data-lazy-video','');set(n,'aria-hidden','true');set(n,'poster','/assets/img/poster.webp');
    const source=nodes(n,x=>x.tagName==='source')[0];if(source){set(source,'data-src',get(source,'src'));source.attrs=source.attrs.filter(a=>a.name!=='src');}
   }
   if(n.tagName==='a'&&get(n,'target')==='_blank')set(n,'rel','noopener noreferrer');
   for(const a of n.attrs||[]){
    if(/^on/i.test(a.name))throw new Error(`Inline event ${name}:${a.name}`);
    if(['src','href','poster','data-src'].includes(a.name)){
     const url=a.value.replace(/^\.\//,'');
     if(a.name==='href'&&url==='#ai'&&name!=='index.html'){a.value=pageUrl('index.html',lang).replace(origin,'')+'#ai';continue;}
     if(url.startsWith('assets/'))a.value=assetMap.get(url)||'/'+url;
     else if(a.name==='href'&&/^[a-z-]+\.html(?:#.*)?$/.test(url)){
      const [file,hash]=url.split('#');const available=legal[lang]||!['privacy.html','legal-notice.html','cookies.html'].includes(file)?lang:'es';
      a.value=pageUrl(file,available).replace(origin,'')+(hash?'#'+hash:'');
     }
    }
   }
  });
  for(const scene of nodes(doc,n=>(get(n,'class')||'').split(' ').includes('cap-scene'))){
    const labels=extra.scenes[get(scene,'data-scene')];if(!labels)continue;
    scene.childNodes=[];append(scene,`<div class="cap-static-scene">${labels.map((label,i)=>`<div><span aria-hidden="true">${String(i+1).padStart(2,'0')}</span><p>${escape(translate(label,dict))}</p></div>`).join('')}</div>`);
  }
  for(const script of nodes(doc,n=>n.tagName==='script'&&(get(n,'src')||'').includes('cap-emoji-scenes')))remove(script);
  for(const link of nodes(doc,n=>n.tagName==='a'&&(get(n,'href')||'').includes('linkedin.com/in/llu')))remove(link);
  if(name==='services.html'){
   const [heading,questions]=extra.faq[lang];
   append(main,`<section class="cap-faq"><h2>${escape(heading)}</h2>${questions.map(([q,a])=>`<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('')}</section>`);
  }
  for(const button of nodes(doc,n=>n.tagName==='button'&&['Ahorra tiempo','Reduce costes'].map(s=>translate(s,dict)).includes(text(n).trim()))){button.tagName='span';button.nodeName='span';button.attrs=button.attrs.filter(a=>a.name!=='type');}
  // Correct missing spaces at visual line breaks for assistive technology/crawlers.
  for(const br of nodes(doc,n=>n.tagName==='br')){const p=br.parentNode,i=p.childNodes.indexOf(br);p.childNodes.splice(i,0,{nodeName:'#text',value:' ',parentNode:p});}
  set(main,'id','main-content');
  const skip=lang==='es'?'Saltar al contenido':(extra.ui[lang]?.skip||'Skip to content');
  const skipNode=parseFragment(`<a class="cap-skip" href="#main-content">${skip}</a>`).childNodes[0];skipNode.parentNode=body;body.childNodes.unshift(skipNode);
  const meta=extra.meta[name];
  const title=legalKey?legal[lang][legalKey][0]+' — CAP Consultor':meta?translate(meta[0],dict):text(nodes(head,n=>n.tagName==='title')[0]);
  const description=legalKey?legal[lang][legalKey][1]:meta?translate(meta[1],dict):(get(nodes(head,n=>n.tagName==='meta'&&get(n,'name')==='description')[0]||{},'content')||translate(extra.scope,dict));
  for(const el of nodes(head,n=>n.tagName==='title'||n.tagName==='meta'&&['description','og:title','og:description','og:url','og:locale','twitter:title','twitter:description','robots'].includes(get(n,'name')||get(n,'property'))))remove(el);
  const url=pageUrl(name,lang);
  append(head,`<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}"><meta property="og:locale" content="${({es:'es_ES',en:'en_GB',fr:'fr_FR',it:'it_IT',de:'de_DE',pt:'pt_PT'})[lang]}"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="robots" content="${name==='404.html'?'noindex,follow':'index,follow,max-image-preview:large'}">`);
  if(name!=='404.html'){
   append(head,`<link rel="canonical" href="${url}">`);
   for(const alt of langs.filter(l=>!legalKey||legal[l]))append(head,`<link rel="alternate" hreflang="${alt}" href="${pageUrl(name,alt)}">`);
   append(head,`<link rel="alternate" hreflang="x-default" href="${pageUrl(name,'es')}">`);
   const schema={'@context':'https://schema.org','@graph':[
    {'@type':'WebSite','@id':origin+'/#website',name:'CAP Consultor',url:origin+'/',inLanguage:langs},
    {'@type':'WebPage','@id':url+'#page',url,name:title,description,inLanguage:lang,isPartOf:{'@id':origin+'/#website'},about:{'@type':'Thing',name:'CAP Consultor',description:translate(extra.scope,dict)}},
   ]};
   if(name==='services.html')schema['@graph'].push({'@type':'ItemList',name:translate('Servicios',dict),itemListElement:extra.services.map((name,index)=>({'@type':'ListItem',position:index+1,item:{'@type':'Service',name:translate(name,dict),areaServed:[{'@type':'Country',name:'Spain'},'Worldwide'],availableChannel:{'@type':'ServiceChannel',serviceUrl:pageUrl('contact.html',lang)}}}))});
   append(head,`<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`);
   sitemap.push(url);
  }
  for(const file of ['assets/css/cap-consent.css','assets/css/cap-enhancements.css'])append(head,`<link rel="stylesheet" href="${assetMap.get(file)}">`);
  // Consent must exist before the launcher; scripts are deferred in document order.
  const chat=nodes(doc,n=>n.tagName==='script'&&(get(n,'src')||'').includes('cap-chat.'))[0];
  const consent=parseFragment(`<script defer src="${assetMap.get('assets/js/cap-consent.js')}"></script>`).childNodes[0];
  if(chat){const parent=chat.parentNode;consent.parentNode=parent;parent.childNodes.splice(parent.childNodes.indexOf(chat),0,consent);}else{consent.parentNode=body;body.childNodes.push(consent);}
  if(name==='index.html')append(body,`<script defer src="${assetMap.get('assets/js/cap-media.js')}"></script>`);
  const footer=nodes(doc,n=>n.tagName==='footer')[0];if(footer)append(footer,`<p class="cap-footer-privacy"><a href="${pageUrl('cookies.html',legal[lang]?lang:'es').replace(origin,'')}">${escape((legal[lang]||legal.es).cookies[0])}</a></p>`);
  const languageFooter=nodes(doc,n=>n.tagName==='footer')[0]||body;
  append(languageFooter,`<nav class="cap-language-links" aria-label="Languages">${langs.filter(l=>!legalKey||legal[l]).map(l=>`<a lang="${l}" hreflang="${l}" href="${pageUrl(name==='404.html'?'index.html':name,l).replace(origin,'')}">${({es:'Español',en:'English',fr:'Français',it:'Italiano',de:'Deutsch',pt:'Português'})[l]}</a>`).join(' · ')}</nav>`);
  // Correct initial disabled state after removing the old inline consent script.
  const submit=nodes(doc,n=>get(n,'id')==='submit-btn')[0];if(submit){submit.attrs=submit.attrs.filter(a=>a.name!=='disabled');set(submit,'style','');}
  const file=path.join(out,lang==='es'?'':lang,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,serialize(doc));generated++;
 }
}
for(const file of (await readdir(root)).filter(f=>/^google.*\.html$|\.(png|svg|ico)$/.test(f)))await cp(path.join(root,file),path.join(out,file));
await writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemap.map(url=>`  <url><loc>${url}</loc></url>`).join('\n')+'\n</urlset>\n');
await writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile(path.join(out,'llms.txt'),`# CAP Consultor\n\n${extra.scope}\n\n- [Servicios](${origin}/services.html)\n- [Método](${origin}/method.html)\n- [Casos reales](${origin}/cases.html)\n- [Contacto](${origin}/contact.html): contact@capconsultor.eu · +34 669 802 256\n- [Privacidad](${origin}/privacy.html)\n\nFuente: contenido público del sitio. Las páginas son la referencia completa y vigente. No se prometen resultados garantizados.\n`);
console.log(`Built ${generated} HTML pages; sitemap has ${sitemap.length} canonical URLs.`);
