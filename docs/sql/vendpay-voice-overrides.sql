create table public.vendpay_voice_overrides (
 message_id text primary key,
 source text not null,
 text text not null check (length(text) between 1 and 2000),
 updated_at timestamptz not null default now()
);
alter table public.vendpay_voice_overrides enable row level security;
revoke all on public.vendpay_voice_overrides from public, anon, authenticated;
grant select, insert, update, delete on public.vendpay_voice_overrides to service_role;
