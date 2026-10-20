-- Applied remotely as vendpay_tenant_members, separate from original account ledgers.
create table public.vendpay_tenant_create_operations (
 tenant_id uuid not null references public.vendpay_tenants(id),
 call_hash text not null, card_hash text not null, payload_hash text not null,
 status text not null default 'reserved' check(status in ('reserved','sent','confirmed','existing','rejected','uncertain')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(tenant_id,call_hash), unique(tenant_id,card_hash)
);
create index vendpay_tenant_create_recent on public.vendpay_tenant_create_operations(tenant_id,created_at);
create table public.vendpay_tenant_edit_sessions (
 tenant_id uuid not null references public.vendpay_tenants(id),
 call_hash text not null, user_id bigint not null, baseline jsonb not null, intended jsonb,
 status text not null default 'editing' check(status in ('editing','sending','uncertain','confirmed','cancelled','conflict')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 minutes', updated_at timestamptz not null default now(),
 primary key(tenant_id,call_hash)
);
create unique index vendpay_tenant_edit_inflight on public.vendpay_tenant_edit_sessions(tenant_id,user_id) where status in ('sending','uncertain');
alter table public.vendpay_tenant_create_operations enable row level security;
alter table public.vendpay_tenant_edit_sessions enable row level security;
revoke all on public.vendpay_tenant_create_operations,public.vendpay_tenant_edit_sessions from public,anon,authenticated;
grant select,insert,update on public.vendpay_tenant_create_operations,public.vendpay_tenant_edit_sessions to service_role;
