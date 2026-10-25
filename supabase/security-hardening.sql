-- CAP security baseline. Apply before deploying the validated server endpoints.
-- No existing contact/conversation records are deleted or modified.
begin;
create schema if not exists cap_private;
revoke all on schema cap_private from public, anon, authenticated;
grant usage on schema cap_private to service_role;
create table if not exists cap_private.rate_limits (
  key text primary key check (char_length(key) <= 200),
  count integer not null check (count > 0),
  expires_at timestamptz not null
);
alter table cap_private.rate_limits enable row level security;
revoke all on cap_private.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on cap_private.rate_limits to service_role;
create index if not exists cap_rate_limits_expiry on cap_private.rate_limits(expires_at);

create or replace function public.cap_check_rate_limits(p_rules jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r jsonb; stamp timestamptz := clock_timestamp(); bucket_end timestamptz;
  observed integer; max_count integer; seconds integer; bucket_key text;
  accepted boolean := true; retry_seconds integer := 1;
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) not between 1 and 8 then
    raise exception 'Invalid rate rules';
  end if;
  delete from cap_private.rate_limits where expires_at < stamp;
  -- Consistent locking order prevents deadlocks under concurrent requests.
  for r in select value from jsonb_array_elements(p_rules) order by value->>'key' loop
    seconds := (r->>'seconds')::integer; max_count := (r->>'limit')::integer;
    if seconds not between 1 and 86400 or max_count not between 1 and 10000 or length(r->>'key') not between 1 and 150 then raise exception 'Invalid rate rule'; end if;
    bucket_end := to_timestamp((floor(extract(epoch from stamp)/seconds)+1)*seconds);
    bucket_key := (r->>'key')||':'||extract(epoch from bucket_end)::bigint::text;
    insert into cap_private.rate_limits as b(key,count,expires_at) values(bucket_key,1,bucket_end)
      on conflict(key) do update set count = least(b.count+1, max_count+1)
      returning count into observed;
    if observed > max_count then
      accepted := false;
      retry_seconds := greatest(retry_seconds, ceil(extract(epoch from bucket_end-stamp))::integer);
    end if;
  end loop;
  return jsonb_build_object('allowed',accepted,'retry_after',retry_seconds);
end; $$;
revoke all on function public.cap_check_rate_limits(jsonb) from public, anon, authenticated;
grant execute on function public.cap_check_rate_limits(jsonb) to service_role;
alter table public.clientes_web add column if not exists consent_at timestamptz;
alter table public.clientes_web add column if not exists privacy_version text;
-- Existing rows keep NULL rather than manufacturing evidence of consent.
revoke all on public.conversations, public.messages, public.leads from anon, authenticated;
commit;

-- AFTER the form is served through /api/contact and verified, run separately:
-- revoke insert on public.clientes_web from anon, authenticated;
-- drop policy if exists anon_can_insert_web_leads on public.clientes_web;
-- drop policy if exists auth_can_insert_web_leads on public.clientes_web;
