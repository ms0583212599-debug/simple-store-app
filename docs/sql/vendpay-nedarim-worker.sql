create table public.vendpay_nedarim_worker_state (
 mosad text primary key references public.vendpay_nedarim_connections(mosad),
 enabled boolean not null default false,
 last_id bigint not null default 0,
 activated_at timestamptz,
 lease_until timestamptz,
 last_run_at timestamptz,
 last_error text
);
insert into public.vendpay_nedarim_worker_state(mosad,last_id) values ('7014693',81353374);
create table public.vendpay_nedarim_events (
 mosad text not null,
 transaction_id bigint not null,
 tenant_id uuid not null references public.vendpay_tenants(id),
 category text not null,
 card_number text,
 action text not null,
 status text not null,
 target_date date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(mosad,transaction_id)
);
alter table public.vendpay_nedarim_worker_state enable row level security;
alter table public.vendpay_nedarim_events enable row level security;
revoke all on public.vendpay_nedarim_worker_state,public.vendpay_nedarim_events from public,anon,authenticated;
grant select,insert,update on public.vendpay_nedarim_worker_state,public.vendpay_nedarim_events to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
revoke all on net.http_request_queue, net._http_response from public, anon, authenticated;
