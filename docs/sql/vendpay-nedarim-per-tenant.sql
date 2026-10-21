
alter table public.vendpay_nedarim_connections drop constraint vendpay_nedarim_connections_mosad_check;
alter table public.vendpay_nedarim_connections add constraint vendpay_nedarim_mosad_format check(mosad ~ '^[1-9][0-9]{2,14}$');
alter table public.vendpay_nedarim_connections add column tenant_id uuid unique references public.vendpay_tenants(id);
do $$ begin
 if exists(select 1 from public.vendpay_nedarim_rules r where (select count(distinct x->>'tenant_id') from jsonb_array_elements(r.rules) x)>1) then raise exception 'multiple_tenants_in_existing_connection';end if;
end $$;
update public.vendpay_nedarim_connections c set tenant_id=(select (r.rules->0->>'tenant_id')::uuid from public.vendpay_nedarim_rules r where r.mosad=c.mosad) where c.tenant_id is null;
update public.vendpay_nedarim_rules r set rules=(select coalesce(jsonb_agg(x||jsonb_build_object('id',gen_random_uuid())), '[]'::jsonb) from jsonb_array_elements(r.rules) x);
alter table public.vendpay_nedarim_worker_state add column initialized boolean not null default true;

create or replace function public.vendpay_nedarim_connect(p_tenant uuid,p_mosad text,p_ciphertext text,p_iv text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare old_mosad text; bound uuid;
begin
 perform pg_advisory_xact_lock(hashtext('vendpay_nedarim_config'));
 if p_mosad !~ '^[1-9][0-9]{2,14}$' or not exists(select 1 from vendpay_tenants where id=p_tenant) then raise exception 'invalid_connection';end if;
 select tenant_id into bound from vendpay_nedarim_connections where mosad=p_mosad;
 if bound is not null and bound<>p_tenant then raise exception 'institution_in_use';end if;
 select mosad into old_mosad from vendpay_nedarim_connections where tenant_id=p_tenant;
 perform 1 from vendpay_nedarim_worker_state where mosad in(p_mosad,old_mosad) for update;
 if exists(select 1 from vendpay_nedarim_worker_state where mosad in(p_mosad,old_mosad) and lease_until>now()) then raise exception 'worker_busy';end if;
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
end $$;
revoke all on function public.vendpay_nedarim_connect(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.vendpay_nedarim_connect(uuid,text,text,text) to service_role;

create or replace function public.vendpay_nedarim_rule_change(p_tenant uuid,p_mosad text,p_id text,p_rule jsonb,p_delete boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_rules jsonb; result jsonb; item jsonb; found boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtext('vendpay_nedarim_config'));
 if not exists(select 1 from vendpay_nedarim_connections where mosad=p_mosad and tenant_id=p_tenant)then raise exception 'connection_changed';end if;
 select rules into current_rules from vendpay_nedarim_rules where mosad=p_mosad for update;
 result='[]'::jsonb;
 for item in select value from jsonb_array_elements(current_rules) loop
  if item->>'id'=p_id then found=true;if not p_delete then result=result||jsonb_build_array(p_rule);end if;
  else result=result||jsonb_build_array(item);end if;
 end loop;
 if not found then
  if p_delete or p_id is not null then raise exception 'rule_missing';end if;
  result=result||jsonb_build_array(p_rule);
 end if;
 if jsonb_array_length(result)>50 or exists(select 1 from jsonb_array_elements(result)x where x->>'tenant_id'<>p_tenant::text) then raise exception 'invalid_rules';end if;
 if (select count(*) from jsonb_array_elements(result))<>(select count(distinct x->>'category')from jsonb_array_elements(result)x) then raise exception 'duplicate_category';end if;
 update vendpay_nedarim_rules set rules=result,updated_at=now()where mosad=p_mosad;
 return result;
end $$;
revoke all on function public.vendpay_nedarim_rule_change(uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.vendpay_nedarim_rule_change(uuid,text,text,jsonb,boolean) to service_role;
