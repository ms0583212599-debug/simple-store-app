create table public.vendpay_zone_sessions (
 tenant_id uuid not null references public.vendpay_tenants(id),call_hash text not null,
 terminal_id bigint not null,kind text not null check(kind in ('price_zones','mode_zones')),
 baseline jsonb not null,intended jsonb,
 status text not null default 'editing' check(status in ('editing','sending','uncertain','confirmed','cancelled','conflict')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 primary key(tenant_id,call_hash)
);
create unique index vendpay_zone_inflight on public.vendpay_zone_sessions(tenant_id,terminal_id,kind) where status in ('sending','uncertain');
alter table public.vendpay_zone_sessions enable row level security;
revoke all on public.vendpay_zone_sessions from public,anon,authenticated;
grant select,insert,update on public.vendpay_zone_sessions to service_role;
