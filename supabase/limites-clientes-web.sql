-- CAP — límites de longitud en `clientes_web`.
--
-- Histórico: la política RLS permitía INSERT anónimo (el antiguo formulario
-- de la web lo usaba), pero las columnas son `text` sin longitud máxima. En la auditoría
-- del 31-08-2026 se comprobó que se puede insertar un campo de 100.000
-- caracteres con la clave publishable, que es pública por diseño.
--
-- El recorte que hace assets/js/contact-form.js es solo la primera barrera:
-- cualquiera puede llamar a la API de Supabase directamente sin pasar por la
-- web. El límite que de verdad protege es este, en la base de datos.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar y ejecutar.
-- Es idempotente: se puede lanzar varias veces sin problema.

-- No eliminar registros como parte de una migración de restricciones.

-- 2. Límites de longitud. Holgados para cualquier envío legítimo y alineados
--    con los `maxlength` del formulario.
alter table public.clientes_web
  drop constraint if exists clientes_web_longitudes;

alter table public.clientes_web
  add constraint clientes_web_longitudes check (
    char_length(coalesce(nombre_contacto, '')) <= 120
    and char_length(coalesce(nombre_negocio, '')) <= 160
    and char_length(coalesce(email, ''))          <= 254
    and char_length(coalesce(mensaje, ''))        <= 4000
  );

-- 3. Comprobación: debe fallar con "violates check constraint".
--    Descomentar para probar.
-- insert into public.clientes_web (nombre_contacto, nombre_negocio, email, origen)
-- values (repeat('A', 5000), 'test', 'a@b.co', 'web');

-- Nota sobre el volumen de envíos: este constraint acota el tamaño de cada
-- fila, no cuántas se pueden crear. Si algún día llega spam automatizado, la
-- solución es Cloudflare Turnstile o similar delante del formulario, no más
-- restricciones en la tabla.
