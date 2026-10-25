-- Apply only after the new server-backed contact form is live.
begin;
revoke insert on public.clientes_web from anon, authenticated;
drop policy if exists anon_can_insert_web_leads on public.clientes_web;
drop policy if exists auth_can_insert_web_leads on public.clientes_web;
commit;
