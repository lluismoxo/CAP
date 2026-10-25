# CAP Consultor

Sitio estático desplegado en Vercel desde `main`. Dominio: https://capconsultor.eu.

## Desarrollo y comprobación

```sh
npm ci --ignore-scripts
npm test
```

El build genera `dist/`; no se publica directamente la raíz del repositorio. `tools/check-site.mjs` comprueba páginas, encabezados, metadatos, idiomas, enlaces, imágenes, scripts y sitemap. Vercel ejecuta ambas etapas antes de publicar.

## Fuentes de contenido

- HTML de la raíz: estructura y contenido base en español.
- `content/site.json`: textos vigentes, traducciones adicionales, servicios y preguntas frecuentes.
- `content/legal.json`: fuente de los textos legales en seis idiomas; sustituye los antiguos textos de las plantillas al compilar.
- `assets/i18n/*.json`: catálogo de traducciones estáticas.
- `assets/js/cap-consent.js`: preferencias opcionales de privacidad, revocables y con caducidad de 180 días.

Español en `/`; traducciones completas en `/en`, `/fr`, `/it`, `/de` y `/pt`. Canonical y hreflang se generan por página. El idioma no depende de JavaScript ni de la configuración del navegador. El sitemap incluye 60 URLs y excluye los errores 404.

## Formularios y chatbot

El formulario llama a `https://capchatbotfinal.vercel.app/api/contact`, del repositorio CAP-CHATBOT. No escribe directamente en Supabase. Validación, cuotas persistentes, acceso a la base de datos y secretos viven en ese servidor. El origen directo permite a Vercel identificar la IP de entrada para las cuotas.

El chat carga bajo petición y consentimiento; no hay analítica ni publicidad. No se almacena el historial en CAP. El proveedor de IA procesa los mensajes que el visitante envía. Los textos legales explican los proveedores y la situación actual gratuita y sin empresa.

## Seguridad y despliegue

`vercel.json` configura CSP, HSTS, permisos, caché y rutas. JS/CSS usan nombres con hash. Los vídeos se cargan progresivamente y se omiten en móvil, ahorro de datos y movimiento reducido. Las escenas explicativas son HTML estático.

La migración inicial `supabase/security-hardening.sql` debe aplicarse antes del servidor nuevo. Después de publicar el formulario nuevo, aplicar `supabase/close-public-contact.sql` para cerrar la inserción anónima antigua. No borrar registros históricos. El proyecto Supabase comparte otras integraciones: revisar dependencias antes de modificar tablas ajenas a este sitio.

La identidad completa del responsable está omitida por decisión del titular: estos textos no acreditan cumplimiento legal completo. Revisar identificación, conservación de datos, encargados y obligaciones si cambia la actividad, se cobran servicios o se incorporan nuevas cookies.
