create table public.vendpay_nedarim_rules (
 mosad text primary key references public.vendpay_nedarim_connections(mosad),
 rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules)='array'),
 updated_at timestamptz not null default now()
);
alter table public.vendpay_nedarim_rules enable row level security;
revoke all on public.vendpay_nedarim_rules from public,anon,authenticated;
grant select,insert,update on public.vendpay_nedarim_rules to service_role;