(() => {
  'use strict';
  const videos = document.querySelectorAll('video[data-lazy-video]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const light = reduced.matches || navigator.connection?.saveData || matchMedia('(max-width: 767px)').matches;
  if (light) return;
  const observer = new IntersectionObserver(entries => entries.forEach(({target:video,isIntersecting}) => {
    if (!isIntersecting) {video.pause();return;}
    if (!video.dataset.loaded) {
      video.querySelectorAll('source[data-src]').forEach(source => {source.src=source.dataset.src;});
      video.load();video.dataset.loaded='true';
    }
    video.play().catch(()=>{});
  }),{rootMargin:'0px',threshold:0.05});
  const start=()=>videos.forEach(video=>observer.observe(video));
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)videos.forEach(video=>video.pause());});
  reduced.addEventListener('change',()=>{if(reduced.matches){observer.disconnect();videos.forEach(video=>video.pause());}});
})();
