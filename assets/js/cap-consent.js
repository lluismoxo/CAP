(() => {
  'use strict';
  const KEY='cap-consent-v1',MAX_AGE=180*86400000;
  const texts={
    es:['Privacidad a tu medida','Usamos almacenamiento técnico para recordar tu decisión. El asistente de IA es opcional y solo se conecta al abrirlo con tu permiso. No usamos analítica ni publicidad.','Aceptar','Rechazar','Configurar','Preferencias de privacidad','Necesarias','Guardan esta elección y permiten usar la web. Siempre activas.','Asistente de IA','Permite cargar el chat alojado en Vercel. Los mensajes que envíes se procesan con OpenAI.','Guardar preferencias','Cerrar','Política de cookies','Cookies y privacidad'],
    en:['Your privacy choices','We use technical storage to remember your choice. The AI assistant is optional and connects only when you open it with permission. We use no analytics or advertising.','Accept','Reject','Configure','Privacy preferences','Necessary','Store this choice and keep the website working. Always active.','AI assistant','Allows the chat hosted on Vercel to load. Messages you send are processed with OpenAI.','Save preferences','Close','Cookie policy','Cookies and privacy'],
    fr:['Vos choix de confidentialité','Un stockage technique mémorise votre choix. L’assistant IA est facultatif et ne se connecte que si vous l’ouvrez avec votre accord. Ni analyse d’audience ni publicité.','Accepter','Refuser','Configurer','Préférences de confidentialité','Nécessaires','Mémorisent ce choix et assurent le fonctionnement du site. Toujours actives.','Assistant IA','Autorise le chargement du chat hébergé sur Vercel. Les messages envoyés sont traités avec OpenAI.','Enregistrer','Fermer','Politique de cookies','Cookies et confidentialité'],
    it:['Le tue scelte sulla privacy','La memoria tecnica ricorda la tua scelta. L’assistente IA è facoltativo e si connette solo quando lo apri con il tuo consenso. Nessuna analisi o pubblicità.','Accetta','Rifiuta','Configura','Preferenze sulla privacy','Necessari','Memorizzano questa scelta e consentono il funzionamento del sito. Sempre attivi.','Assistente IA','Consente di caricare la chat ospitata su Vercel. I messaggi inviati sono elaborati con OpenAI.','Salva preferenze','Chiudi','Informativa sui cookie','Cookie e privacy'],
    de:['Ihre Privatsphäre','Technischer Speicher merkt sich Ihre Auswahl. Der KI-Assistent ist optional und verbindet sich erst, wenn Sie ihn mit Zustimmung öffnen. Keine Analyse oder Werbung.','Akzeptieren','Ablehnen','Einstellen','Datenschutzeinstellungen','Erforderlich','Speichern diese Auswahl und ermöglichen die Nutzung der Website. Immer aktiv.','KI-Assistent','Erlaubt den auf Vercel gehosteten Chat. Gesendete Nachrichten werden mit OpenAI verarbeitet.','Auswahl speichern','Schließen','Cookie-Richtlinie','Cookies und Datenschutz'],
    pt:['As suas escolhas de privacidade','O armazenamento técnico guarda a sua escolha. O assistente de IA é opcional e só se liga quando o abre com autorização. Não usamos análise nem publicidade.','Aceitar','Rejeitar','Configurar','Preferências de privacidade','Necessárias','Guardam esta escolha e permitem usar o site. Sempre ativas.','Assistente de IA','Permite carregar o chat alojado na Vercel. As mensagens enviadas são processadas com a OpenAI.','Guardar preferências','Fechar','Política de cookies','Cookies e privacidade']
  };
  const lang=document.documentElement.lang||'es',t=texts[lang]||texts.es;
  let choice=null;
  try {const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version===1 && typeof saved.assistant==='boolean' && Date.now()-saved.at<MAX_AGE && saved.at<=Date.now())choice=saved;} catch{}
  const banner=document.createElement('section');banner.className='cap-consent';banner.setAttribute('aria-label',t[0]);
  const title=document.createElement('h2');title.textContent=t[0];const info=document.createElement('p');info.textContent=t[1];
  const policy=document.createElement('a');policy.href=(lang==='es'?'/':'/'+lang+'/')+'cookies.html';policy.textContent=t[12];
  const actions=document.createElement('div');actions.className='cap-consent-actions';
  function button(label,fn){const el=document.createElement('button');el.type='button';el.textContent=label;el.addEventListener('click',fn);return el;}
  const dialog=document.createElement('dialog');dialog.className='cap-consent-dialog';dialog.setAttribute('aria-labelledby','cap-consent-title');
  const heading=document.createElement('h2');heading.id='cap-consent-title';heading.textContent=t[5];
  const necessary=document.createElement('h3');necessary.textContent=t[6];const note=document.createElement('p');note.textContent=t[7];
  const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';label.append(checkbox,document.createTextNode(' '+t[8]));
  const explanation=document.createElement('p');explanation.textContent=t[9];
  const controls=document.createElement('div');controls.className='cap-consent-actions';
  const settings=()=>{checkbox.checked=choice?.assistant===true;if(!dialog.open)dialog.showModal();};
  function save(assistant){choice={version:1,assistant,at:Date.now()};try{localStorage.setItem(KEY,JSON.stringify(choice));}catch{}banner.hidden=true;dialog.close();document.dispatchEvent(new CustomEvent('cap:consent',{detail:{assistant}}));}
  actions.append(button(t[2],()=>save(true)),button(t[3],()=>save(false)),button(t[4],settings));
  controls.append(button(t[10],()=>save(checkbox.checked)),button(t[11],()=>dialog.close()));
  dialog.append(heading,necessary,note,label,explanation,controls);banner.append(title,info,policy,actions);banner.hidden=!!choice;
  const manage=button(t[13],settings);manage.className='cap-consent-manage';
  document.body.append(banner,dialog,manage);
  window.capConsent={allowsAssistant:()=>choice?.assistant===true,open:settings};
})();
