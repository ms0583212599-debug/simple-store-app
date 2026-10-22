create extension if not exists pg_cron;
create extension if not exists pg_net;
create function public.billing_nedarim_tick()returns void language plpgsql security definer set search_path='' as $$
declare secret text;stamp text;signature text;raw text:='{}';
begin
 -- Only reconcile existing mandates. This worker never creates or debits a payment.
 if not exists(select 1 from public.billing_nedarim_checkouts where keva_id is not null and state<>'cancelled')then return;end if;
 select bridge_secret into secret from public.finance_integrations where id=true;
 if secret is null then return;end if;
 stamp:=floor(extract(epoch from clock_timestamp())*1000)::bigint::text;
 signature:=encode(extensions.hmac(convert_to(stamp||'.'||raw,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
 perform net.http_post(url:='https://icldwmvkbeanyypkpeia.supabase.co/functions/v1/finance-nedarim-worker',headers:=jsonb_build_object('Content-Type','application/json','x-finance-time',stamp,'x-finance-signature',signature),body:=raw::jsonb,timeout_milliseconds:=60000);
end $$;
revoke all on function public.billing_nedarim_tick()from public,anon,authenticated;
select cron.schedule('finance-nedarim-reconcile','*/15 * * * *','select public.billing_nedarim_tick()');
