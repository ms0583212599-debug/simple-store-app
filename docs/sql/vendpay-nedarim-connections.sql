create table public.vendpay_nedarim_connections (
 mosad text primary key check (mosad = '7014693'),
 ciphertext text not null,
 iv text not null,
 updated_at timestamptz not null default now()
);
alter table public.vendpay_nedarim_connections enable row level security;
revoke all on public.vendpay_nedarim_connections from public, anon, authenticated;
grant select, insert, update on public.vendpay_nedarim_connections to service_role;