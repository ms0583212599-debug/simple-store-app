-- Additive profile fields. Existing RLS and server-only access remain unchanged.
alter table public.vendpay_tenants
  add column address text not null default '' check (char_length(address) <= 300),
  add column phone text not null default '' check (char_length(phone) <= 32),
  add column profile_revision integer not null default 0 check (profile_revision >= 0);
