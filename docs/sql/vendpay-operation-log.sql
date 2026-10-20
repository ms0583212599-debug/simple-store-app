create table public.vendpay_operation_log (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 tenant_id uuid references public.vendpay_tenants(id),
 source text not null,action text not null,result text not null,
 http_status integer not null,duration_ms integer not null,call_hash text
);
create index vendpay_operation_log_recent on public.vendpay_operation_log(created_at desc,id desc);
create index vendpay_operation_log_tenant on public.vendpay_operation_log(tenant_id,created_at desc);
alter table public.vendpay_operation_log enable row level security;
revoke all on public.vendpay_operation_log from public,anon,authenticated;
grant select,insert on public.vendpay_operation_log to service_role;
grant usage,select on sequence public.vendpay_operation_log_id_seq to service_role;
