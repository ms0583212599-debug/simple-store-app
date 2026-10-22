alter table public.billing_subscriptions add column provider_customer_reference text,add column provider_payment_reference text,add column billing_anchor timestamptz,add column paid_cycles integer not null default 0,add column billing_run uuid not null default gen_random_uuid();
alter table public.billing_charges add column cycle integer,add column attempt_count integer not null default 0,add column last_attempt_at timestamptz,add column billing_run uuid;
create unique index billing_charge_cycle on public.billing_charges(subscription_id,billing_run,cycle);
create table public.billing_provider_events(event_id text primary key,subscription_id uuid not null references public.billing_subscriptions(id),created_at timestamptz not null default now());
alter table public.billing_provider_events enable row level security;
revoke all on public.billing_provider_events from anon,authenticated;
-- Internal payment boundary: these functions are NEVER directly exposed to a browser or caller.
-- A provider adapter must verify signature, currency ILS, amount and a server-created checkout reference first.
create function public.billing_consent(p_account uuid,p_service uuid,p_revision integer)returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.billing_services;r public.billing_subscriptions;
begin
 select * into s from public.billing_services where id=p_service for update;
 if not found or not s.enabled or not s.payment_required or not s.provider_ready then raise exception 'billing_not_configured';end if;
 if s.revision<>p_revision then raise exception 'changed';end if;
 if not exists(select 1 from public.finance_accounts where id=p_account and enabled)then raise exception 'unauthorized';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_account::text||p_service::text,0));
 select * into r from public.billing_subscriptions where account_id=p_account and service_id=p_service for update;
 if r.status in ('active','past_due')or r.paid_until>now()then raise exception 'already_subscribed';end if;
 insert into public.billing_subscriptions(account_id,service_id,status,first_amount,renewal_amount,interval_months,billing_mode,trial_days,consent_at,consent_version)
 values(p_account,s.id,'pending',s.first_amount,s.renewal_amount,s.interval_months,s.billing_mode,s.trial_days,now(),s.revision)
 on conflict(account_id,service_id)do update set status='pending',first_amount=case when exists(select 1 from public.billing_charges bc where bc.subscription_id=r.id and bc.status='succeeded')then s.renewal_amount else s.first_amount end,renewal_amount=s.renewal_amount,interval_months=s.interval_months,billing_mode=s.billing_mode,trial_days=s.trial_days,consent_at=now(),consent_version=s.revision,cancelled_at=null,provider_customer_reference=null,provider_payment_reference=null,billing_run=gen_random_uuid(),billing_anchor=null,paid_cycles=0,period_start=null,paid_until=null returning * into r;
 insert into public.billing_events(subscription_id,service_id,kind,details)values(r.id,s.id,'terms_accepted',jsonb_build_object('revision',s.revision,'first_amount',s.first_amount,'renewal_amount',s.renewal_amount,'interval_months',s.interval_months));
 return to_jsonb(r)-'provider_payment_reference'-'provider_customer_reference';
end $$;
create function public.billing_first_payment(p_subscription uuid,p_event text,p_amount integer,p_currency text,p_payment_ref text,p_customer_ref text,p_method_ref text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.billing_subscriptions;anchor timestamptz:=now();
begin
 select * into r from public.billing_subscriptions where id=p_subscription for update;if not found then raise exception 'not_found';end if;
 if exists(select 1 from public.billing_provider_events where event_id=p_event and subscription_id=r.id)then return '{"duplicate":true}'::jsonb;end if;
 if r.status<>'pending' or r.cancelled_at is not null or r.consent_at is null or p_currency is distinct from 'ILS' or p_amount<>r.first_amount or coalesce(p_method_ref,'')='' then raise exception 'invalid_payment';end if;
 if exists(select 1 from public.billing_charges where subscription_id=r.id and billing_run=r.billing_run and cycle=0)then raise exception 'already_paid';end if;
 insert into public.billing_provider_events(event_id,subscription_id)values(p_event,r.id);
 insert into public.billing_charges(subscription_id,period_start,amount,status,provider_reference,cycle,billing_run)values(r.id,anchor,r.first_amount,'succeeded',p_payment_ref,0,r.billing_run);
 update public.billing_subscriptions set status='active',billing_anchor=anchor,period_start=anchor,paid_until=anchor+make_interval(months=>r.interval_months,days=>r.trial_days),provider_customer_reference=p_customer_ref,provider_payment_reference=p_method_ref,paid_cycles=1 where id=r.id;
 insert into public.billing_events(subscription_id,service_id,kind,details)values(r.id,r.service_id,'first_payment_succeeded',jsonb_build_object('amount',p_amount));return '{"ok":true}'::jsonb;
end $$;
create function public.billing_prepare_due()returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.billing_subscriptions;n integer:=0;
begin
 for r in select x.* from public.billing_subscriptions x join public.billing_services s on s.id=x.service_id where x.status in ('active','past_due')and x.cancelled_at is null and x.paid_until<=now()and x.billing_mode='recurring'and s.enabled and s.payment_required and s.provider_ready for update of x skip locked loop
 insert into public.billing_charges(subscription_id,period_start,amount,cycle,billing_run)values(r.id,r.paid_until,r.renewal_amount,r.paid_cycles,r.billing_run)on conflict do nothing;n:=n+1;
 end loop;return jsonb_build_object('considered',n);
end $$;
create function public.billing_claim_charge(p_charge uuid)returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.billing_charges;r public.billing_subscriptions;s public.billing_services;
begin
 select x.* into r from public.billing_subscriptions x join public.billing_charges charge_row on charge_row.subscription_id=x.id where charge_row.id=p_charge for update of x;if not found then raise exception 'not_found';end if;
 select * into c from public.billing_charges where id=p_charge for update;
 select * into s from public.billing_services where id=r.service_id;
 if r.cancelled_at is not null or not s.enabled or not s.payment_required or not s.provider_ready then update public.billing_charges set status='cancelled'where id=c.id and status='pending';return '{"claimed":false}'::jsonb;end if;
 if c.status not in ('pending','failed')or c.attempt_count>=3 or c.last_attempt_at>now()-interval '1 day' then return '{"claimed":false}'::jsonb;end if;
 update public.billing_charges set status='processing',attempt_count=attempt_count+1,last_attempt_at=now()where id=c.id;
 return jsonb_build_object('claimed',true,'charge_id',c.id,'idempotency_key',c.id,'amount',c.amount,'currency','ILS','customer_reference',r.provider_customer_reference,'payment_reference',r.provider_payment_reference);
end $$;
create function public.billing_charge_result(p_charge uuid,p_event text,p_status text,p_amount integer,p_currency text,p_reference text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.billing_charges;r public.billing_subscriptions;
begin
 select x.* into r from public.billing_subscriptions x join public.billing_charges charge_row on charge_row.subscription_id=x.id where charge_row.id=p_charge for update of x;if not found then raise exception 'not_found';end if;
 select * into c from public.billing_charges where id=p_charge for update;
 if exists(select 1 from public.billing_provider_events where event_id=p_event and subscription_id=r.id)then return '{"duplicate":true}'::jsonb;end if;
 if c.status='succeeded'then return '{"duplicate":true}'::jsonb;end if;
 if c.status not in ('processing','unknown')or p_status not in ('succeeded','failed','unknown')or p_amount<>c.amount or p_currency is distinct from 'ILS' then raise exception 'invalid_payment';end if;
 insert into public.billing_provider_events(event_id,subscription_id)values(p_event,r.id);
 update public.billing_charges set status=p_status,provider_reference=p_reference where id=c.id;
 if p_status='succeeded' then
 update public.billing_subscriptions set status=case when cancelled_at is null then 'active' else 'cancelled'end,period_start=c.period_start,paid_until=billing_anchor+make_interval(months=>interval_months*(c.cycle+1),days=>trial_days),paid_cycles=c.cycle+1 where id=r.id;
 elsif p_status='failed' then update public.billing_subscriptions set status=case when cancelled_at is null then 'past_due' else 'cancelled'end where id=r.id;end if;
 insert into public.billing_events(subscription_id,service_id,kind,details)values(r.id,r.service_id,'charge_'||p_status,jsonb_build_object('amount',p_amount,'charge_id',c.id));return '{"ok":true}'::jsonb;
end $$;
revoke all on function public.billing_consent(uuid,uuid,integer),public.billing_first_payment(uuid,text,integer,text,text,text,text),public.billing_prepare_due(),public.billing_claim_charge(uuid),public.billing_charge_result(uuid,text,text,integer,text,text)from public,anon,authenticated;
grant execute on function public.billing_consent(uuid,uuid,integer),public.billing_first_payment(uuid,text,integer,text,text,text,text),public.billing_prepare_due(),public.billing_claim_charge(uuid),public.billing_charge_result(uuid,text,text,integer,text,text)to service_role;
