create table public.finance_provider_credentials(id boolean primary key default true check(id),secret text not null);
create table public.finance_provider_deliveries(id text primary key,kind text not null,status text not null default 'processing',provider_reference text,created_at timestamptz not null default now());
alter table public.finance_provider_credentials enable row level security;
alter table public.finance_provider_deliveries enable row level security;
revoke all on public.finance_provider_credentials,public.finance_provider_deliveries from anon,authenticated;
create function public.finance_delivery_claim(p_id text,p_kind text)returns jsonb language plpgsql security invoker set search_path='' as $$ declare r public.finance_provider_deliveries;begin insert into public.finance_provider_deliveries(id,kind)values(p_id,p_kind)on conflict do nothing returning * into r;if found then return '{"claimed":true}'::jsonb;end if;select * into r from public.finance_provider_deliveries where id=p_id;return jsonb_build_object('claimed',false,'status',r.status);end $$;
revoke all on function public.finance_delivery_claim(text,text)from public,anon,authenticated;
grant execute on function public.finance_delivery_claim(text,text)to service_role;
