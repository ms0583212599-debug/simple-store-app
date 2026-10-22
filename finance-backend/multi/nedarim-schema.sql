create table public.billing_nedarim_checkouts(
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.billing_subscriptions(id),
 account_id uuid not null references public.finance_accounts(id), service_id uuid not null references public.billing_services(id),
 amount integer not null check(amount>0), mosad text not null, state text not null default 'creating' check(state in('creating','ready','bound','unknown','cancelled')),
 transaction_id text, transaction_key text, keva_id text, cancel_requested boolean not null default false,
 created_at timestamptz not null default now(), last_sync_at timestamptz, last_error text
);
create unique index billing_nedarim_one_open on public.billing_nedarim_checkouts(subscription_id) where state<>'cancelled';
create unique index billing_nedarim_keva on public.billing_nedarim_checkouts(mosad,keva_id) where keva_id is not null;
alter table public.billing_nedarim_checkouts enable row level security;
revoke all on public.billing_nedarim_checkouts from anon,authenticated;
grant all on public.billing_nedarim_checkouts to service_role;

create function public.billing_nedarim_begin(p_account uuid,p_service uuid,p_revision integer,p_mosad text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.billing_services;r public.billing_subscriptions;c public.billing_nedarim_checkouts;j jsonb;
begin
 if not exists(select 1 from public.finance_accounts where id=p_account and enabled) then raise exception 'unauthorized';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_account::text||p_service::text,0));
 select * into s from public.billing_services where id=p_service for update;
 if not found or not s.enabled or not s.payment_required or not s.provider_ready then raise exception 'billing_not_configured';end if;
 if s.revision<>p_revision then raise exception 'changed';end if;
 if s.billing_mode<>'recurring' or s.interval_months<>1 or s.trial_days<>0 or s.first_amount<>s.renewal_amount then raise exception 'monthly_only';end if;
 select * into r from public.billing_subscriptions where account_id=p_account and service_id=p_service;
 select * into c from public.billing_nedarim_checkouts where subscription_id=r.id and state<>'cancelled';
 if found then return to_jsonb(c)||jsonb_build_object('claimed',false);end if;
 j:=public.billing_consent(p_account,p_service,p_revision);
 insert into public.billing_nedarim_checkouts(subscription_id,account_id,service_id,amount,mosad) values((j->>'id')::uuid,p_account,p_service,s.first_amount,p_mosad) returning * into c;
 return to_jsonb(c)||jsonb_build_object('claimed',true);
end $$;

create function public.billing_nedarim_bind(p_checkout uuid,p_mosad text,p_keva text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.billing_nedarim_checkouts;
begin
 select * into c from public.billing_nedarim_checkouts where id=p_checkout for update;
 if not found or c.mosad<>p_mosad or p_keva!~'^[0-9]{1,20}$' then raise exception 'invalid_checkout';end if;
 if c.keva_id is not null and c.keva_id<>p_keva then raise exception 'already_bound';end if;
 update public.billing_nedarim_checkouts set keva_id=p_keva,state=case when state='cancelled' then state else 'bound' end where id=c.id;
 return jsonb_build_object('cancel_requested',c.cancel_requested);
end $$;

create function public.billing_nedarim_payment(p_checkout uuid,p_transaction text,p_amount integer,p_paid_on date)returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.billing_nedarim_checkouts;r public.billing_subscriptions;ref text;event text;
begin
 select * into c from public.billing_nedarim_checkouts where id=p_checkout for update;
 if not found or c.keva_id is null or p_amount<=0 or p_paid_on<c.created_at::date-1 or p_paid_on>current_date+1 or p_transaction!~'^[0-9]{1,20}$' then raise exception 'invalid_payment';end if;
 select * into r from public.billing_subscriptions where id=c.subscription_id for update;
 ref:='nedarim:'||c.mosad||':'||p_transaction;event:=ref;
 if exists(select 1 from public.billing_provider_events where event_id=event)then return '{"duplicate":true}';end if;
 -- Current provider amount may have been changed manually by the owner. The first cycle must match consent.
 if r.paid_cycles=0 and p_amount<>c.amount then raise exception 'amount_mismatch';end if;
 insert into public.billing_provider_events(event_id,subscription_id) values(event,r.id);
 insert into public.billing_charges(subscription_id,period_start,amount,status,provider_reference,billing_run) values(r.id,p_paid_on,p_amount,'succeeded',ref,r.billing_run);
 update public.billing_subscriptions set status=case when cancelled_at is null then 'active' else 'cancelled' end,
 paid_until=greatest(paid_until,(p_paid_on+interval '1 month')::timestamptz),period_start=greatest(period_start,p_paid_on::timestamptz),paid_cycles=paid_cycles+1 where id=r.id;
 insert into public.billing_events(subscription_id,service_id,kind,details)values(r.id,r.service_id,'nedarim_payment',jsonb_build_object('amount',p_amount,'transaction',p_transaction));
 return '{"ok":true}';
end $$;
revoke all on function public.billing_nedarim_begin(uuid,uuid,integer,text),public.billing_nedarim_bind(uuid,text,text),public.billing_nedarim_payment(uuid,text,integer,date) from public,anon,authenticated;
grant execute on function public.billing_nedarim_begin(uuid,uuid,integer,text),public.billing_nedarim_bind(uuid,text,text),public.billing_nedarim_payment(uuid,text,integer,date) to service_role;
