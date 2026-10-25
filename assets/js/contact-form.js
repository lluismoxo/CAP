/* Contact data is validated again on the server; no database key belongs here. */
(() => {
  'use strict';
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const button = document.getElementById('submit-btn');
  if (!form || !status || !button) return;
  const messages = {
    es:['Enviando…','Consulta enviada. Te responderemos por email.','No se ha podido enviar. Inténtalo de nuevo o escribe a contact@capconsultor.eu.'],
    en:['Sending…','Message received. We will reply by email.','Unable to send. Try again or email contact@capconsultor.eu.'],
    fr:['Envoi…','Message reçu. Nous répondrons par email.','Envoi impossible. Réessayez ou écrivez à contact@capconsultor.eu.'],
    it:['Invio…','Messaggio ricevuto. Risponderemo via email.','Invio non riuscito. Riprova o scrivi a contact@capconsultor.eu.'],
    de:['Wird gesendet…','Nachricht erhalten. Wir antworten per E-Mail.','Senden fehlgeschlagen. Erneut versuchen oder contact@capconsultor.eu kontaktieren.'],
    pt:['A enviar…','Mensagem recebida. Responderemos por email.','Não foi possível enviar. Tente novamente ou escreva para contact@capconsultor.eu.']
  };
  let pending = false;
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    const copy = messages[document.documentElement.lang] || messages.es;
    pending = true;button.disabled=true;const label=button.textContent;button.textContent=copy[0];status.hidden=true;
    try {
      const response = await fetch('https://capchatbotfinal.vercel.app/api/contact',{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
        body:JSON.stringify({name:data.name,company:data.company || '',email:data.email,message:data.message || '',website_url:data.website_url || '',consent:form.elements.consent.checked})
      });
      const result=await response.json();
      if (!response.ok || !result.ok) throw new Error(document.documentElement.lang==='es' && result.error ? result.error : copy[2]);
      form.reset();status.textContent=copy[1];status.dataset.kind='success';
    } catch(error) {status.textContent=error.name==='AbortError' || error.name==='TimeoutError' ? copy[2] : error.message || copy[2];status.dataset.kind='error';}
    finally {pending=false;button.disabled=false;button.textContent=label;status.hidden=false;}
  });
})();
