alter table public.finance_provider_credentials add column settings_ciphertext text,add column revision integer not null default 0,add column updated_at timestamptz not null default now();
