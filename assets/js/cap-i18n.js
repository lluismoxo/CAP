/* Language URLs contain fully translated HTML, including when JavaScript is off. */
(() => {
  'use strict';
  const languages=[['es','Español','🇪🇸'],['en','English','🇬🇧'],['fr','Français','🇫🇷'],['it','Italiano','🇮🇹'],['de','Deutsch','🇩🇪'],['pt','Português','🇵🇹']];
  const current=document.documentElement.lang || 'es';
  function picker(){
    const root=document.createElement('details');root.className='cap-lang';
    const summary=document.createElement('summary');summary.className='cap-lang-btn';summary.setAttribute('aria-label','Idioma / Language');
    summary.textContent=languages.find(l=>l[0]===current)?.[2]+' '+current.toUpperCase();root.append(summary);
    const menu=document.createElement('ul');menu.className='cap-lang-menu';
    languages.forEach(([code,label,flag])=>{
      const alternate=document.querySelector('link[rel="alternate"][hreflang="'+code+'"]');if(!alternate)return;
      const item=document.createElement('li');const link=document.createElement('a');link.textContent=flag+' '+label;link.lang=code;link.hreflang=code;
      const url=new URL(alternate.href);link.href=url.pathname+location.hash;if(code===current)link.setAttribute('aria-current','page');item.append(link);menu.append(item);
    });root.append(menu);return root;
  }
  function mount(){
  const cta=document.querySelector('header a[href$="contact.html"]');
  if(cta)cta.before(picker());
  const burger=document.querySelector('button[aria-controls="cap-mnav"]');
  if(burger){const mobile=picker();mobile.classList.add('cap-lang--burgerbar');burger.before(mobile);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  document.addEventListener('click',event=>document.querySelectorAll('.cap-lang[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.cap-lang[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});});
})();
