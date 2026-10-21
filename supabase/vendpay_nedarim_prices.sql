
create table public.vendpay_nedarim_prices(
 mosad text not null references public.vendpay_nedarim_connections(mosad),
 category_id text not null check(category_id ~ '^[1-9][0-9]{0,14}$'),
 tenant_id uuid not null references public.vendpay_tenants(id),
 category_name text not null,
 enabled boolean not null default false,
 default_agorot integer not null check(default_agorot between 0 and 10000000),
 periods jsonb not null default '[]' check(jsonb_typeof(periods)='array'),
 revision uuid not null default gen_random_uuid(),
 lease_until timestamptz,
 last_checked_at timestamptz,
 last_applied_at timestamptz,
 last_target_agorot integer,
 last_observed_agorot integer,
 last_status text not null default 'pending',
 updated_at timestamptz not null default now(),
 primary key(mosad,category_id)
);
alter table public.vendpay_nedarim_prices enable row level security;
revoke all on public.vendpay_nedarim_prices from public,anon,authenticated;
grant select,insert,update on public.vendpay_nedarim_prices to service_role;
create function public.vendpay_nedarim_price_save(p_tenant uuid,p_mosad text,p_category text,p_name text,p_enabled boolean,p_default integer,p_periods jsonb,p_expected uuid)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare row public.vendpay_nedarim_prices;
begin
 perform pg_advisory_xact_lock(hashtext('vendpay_nedarim_config'));
 if not exists(select 1 from vendpay_nedarim_connections where mosad=p_mosad and tenant_id=p_tenant)then raise exception 'connection_changed';end if;
 select * into row from vendpay_nedarim_prices where mosad=p_mosad and category_id=p_category for update;
 if found then
  if row.tenant_id<>p_tenant or row.revision is distinct from p_expected then raise exception 'configuration_changed';end if;
  if row.lease_until>now()then raise exception 'price_busy';end if;
 else
  if p_expected is not null then raise exception 'configuration_changed';end if;
 end if;
 insert into vendpay_nedarim_prices(mosad,category_id,tenant_id,category_name,enabled,default_agorot,periods,last_status)
 values(p_mosad,p_category,p_tenant,p_name,p_enabled,p_default,p_periods,case when p_enabled then 'pending' else 'paused' end)
 on conflict(mosad,category_id)do update set category_name=excluded.category_name,enabled=excluded.enabled,default_agorot=excluded.default_agorot,periods=excluded.periods,revision=gen_random_uuid(),updated_at=now(),last_status=excluded.last_status;
end $$;
revoke all on function public.vendpay_nedarim_price_save(uuid,text,text,text,boolean,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.vendpay_nedarim_price_save(uuid,text,text,text,boolean,integer,jsonb,uuid) to service_role;

CREATE OR REPLACE FUNCTION public.vendpay_nedarim_connect(p_tenant uuid, p_mosad text, p_ciphertext text, p_iv text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare old_mosad text; bound uuid;
begin
 perform pg_advisory_xact_lock(hashtext('vendpay_nedarim_config'));
 if p_mosad !~ '^[1-9][0-9]{2,14}$' or not exists(select 1 from vendpay_tenants where id=p_tenant) then raise exception 'invalid_connection';end if;
 select tenant_id into bound from vendpay_nedarim_connections where mosad=p_mosad;
 if bound is not null and bound<>p_tenant then raise exception 'institution_in_use';end if;
 select mosad into old_mosad from vendpay_nedarim_connections where tenant_id=p_tenant;
 perform 1 from vendpay_nedarim_worker_state where mosad in(p_mosad,old_mosad) for update;
 if exists(select 1 from vendpay_nedarim_worker_state where mosad in(p_mosad,old_mosad) and lease_until>now()) then raise exception 'worker_busy';end if;
 perform 1 from vendpay_nedarim_prices where mosad in(p_mosad,old_mosad) for update;
 if exists(select 1 from vendpay_nedarim_prices where mosad in(p_mosad,old_mosad) and lease_until>now()) then raise exception 'worker_busy';end if;
 if old_mosad is distinct from p_mosad then update vendpay_nedarim_prices set enabled=false,last_status='paused' where mosad in(p_mosad,old_mosad);end if;
 if old_mosad is not null and old_mosad<>p_mosad then
  update vendpay_nedarim_worker_state set enabled=false where mosad=old_mosad;
  update vendpay_nedarim_connections set tenant_id=null where mosad=old_mosad;
 end if;
 if bound is null and exists(select 1 from vendpay_nedarim_connections where mosad=p_mosad) then
  if exists(select 1 from vendpay_nedarim_rules r,jsonb_array_elements(r.rules)x where r.mosad=p_mosad and x->>'tenant_id'<>p_tenant::text) then raise exception 'institution_has_other_history';end if;
 end if;
 insert into vendpay_nedarim_connections(mosad,tenant_id,ciphertext,iv) values(p_mosad,p_tenant,p_ciphertext,p_iv)
 on conflict(mosad)do update set tenant_id=excluded.tenant_id,ciphertext=excluded.ciphertext,iv=excluded.iv,updated_at=now();
 insert into vendpay_nedarim_rules(mosad,rules)values(p_mosad,'[]')on conflict do nothing;
 insert into vendpay_nedarim_worker_state(mosad,enabled,initialized,last_id)values(p_mosad,true,false,0)
 on conflict(mosad)do update set enabled=true,initialized=case when old_mosad is distinct from p_mosad then false else vendpay_nedarim_worker_state.initialized end,last_error=null;
end $function$
