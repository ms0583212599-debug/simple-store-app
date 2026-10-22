create function public.billing_access(p_account uuid,p_slug text default 'finance')returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.billing_services;r public.billing_subscriptions;
begin
 select * into s from public.billing_services where slug=p_slug;
 if not found or not s.enabled then return '{"allowed":false,"reason":"service_disabled"}'::jsonb;end if;
 if p_account='56ae10cb-f40c-4a41-8112-ab8c9f1616c8'::uuid or not s.payment_required then return '{"allowed":true}'::jsonb;end if;
 select * into r from public.billing_subscriptions where account_id=p_account and service_id=s.id;
 if found and r.paid_until>now()then return jsonb_build_object('allowed',true,'paid_until',r.paid_until);end if;
 return jsonb_build_object('allowed',false,'reason','subscription_required','service',to_jsonb(s));
end $$;
create function public.billing_manage(p_account uuid,p_action text,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.billing_services;r public.billing_subscriptions;result jsonb;
begin
 if not exists(select 1 from public.finance_accounts where id=p_account and enabled)then raise exception 'unauthorized';end if;
 if p_action='catalog' then return(select jsonb_build_object('services',coalesce(jsonb_agg(to_jsonb(x)-'provider_ready'),'[]'))from public.billing_services x where enabled);end if;
 if p_action='mine' then return(select jsonb_build_object('subscriptions',coalesce(jsonb_agg((to_jsonb(x)-'provider_payment_reference'-'provider_customer_reference'-'provider_reference')||jsonb_build_object('service_name',s.name)),'[]'))from public.billing_subscriptions x join public.billing_services s on s.id=x.service_id where account_id=p_account);end if;
 if p_action='admin_list' then
  if p_account<>'56ae10cb-f40c-4a41-8112-ab8c9f1616c8'::uuid then raise exception 'unauthorized';end if;
  return jsonb_build_object('services',(select coalesce(jsonb_agg(s order by created_at),'[]')from public.billing_services s),'totals',(select coalesce(jsonb_agg(x),'[]')from(select s.id,s.name,count(distinct r.id)subscribers,coalesce(sum(c.amount)filter(where c.status='succeeded'),0)collected from public.billing_services s left join public.billing_subscriptions r on r.service_id=s.id left join public.billing_charges c on c.subscription_id=r.id group by s.id)x));
 end if;
 if p_action='service_save' then
  if p_account<>'56ae10cb-f40c-4a41-8112-ab8c9f1616c8'::uuid then raise exception 'unauthorized';end if;
  if nullif(p_data->>'id','')is not null then select * into s from public.billing_services where id=(p_data->>'id')::uuid for update;if not found or s.revision<>coalesce((p_data->>'revision')::int,0) then raise exception 'changed';end if;end if;
  if coalesce((p_data->>'payment_required')::boolean,false)and not coalesce(s.provider_ready,false)then raise exception 'billing_not_configured';end if;
  if s.id is null then
   insert into public.billing_services(slug,name,first_amount,renewal_amount,interval_months,billing_mode,trial_days,enabled)values(p_data->>'slug',p_data->>'name',(p_data->>'first_amount')::int,(p_data->>'renewal_amount')::int,(p_data->>'interval_months')::int,p_data->>'billing_mode',coalesce((p_data->>'trial_days')::int,0),coalesce((p_data->>'enabled')::boolean,true))returning * into s;
  else
   update public.billing_services set name=p_data->>'name',first_amount=(p_data->>'first_amount')::int,renewal_amount=(p_data->>'renewal_amount')::int,interval_months=(p_data->>'interval_months')::int,billing_mode=p_data->>'billing_mode',trial_days=coalesce((p_data->>'trial_days')::int,0),enabled=coalesce((p_data->>'enabled')::boolean,true),payment_required=coalesce((p_data->>'payment_required')::boolean,false),revision=revision+1 where id=s.id returning * into s;
  end if;
  insert into public.billing_events(service_id,kind,details)values(s.id,'service_updated',to_jsonb(s));return to_jsonb(s);
 end if;
 select * into s from public.billing_services where id=(p_data->>'service_id')::uuid;
 if not found then raise exception 'not_found';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_account::text||s.id::text,0));
 select * into r from public.billing_subscriptions where account_id=p_account and service_id=s.id for update;
 if p_action='cancel' then
  if r.id is null then raise exception 'not_found';end if;
  update public.billing_subscriptions set status='cancelled',cancelled_at=coalesce(cancelled_at,now())where id=r.id returning * into r;
  update public.billing_charges set status='cancelled'where subscription_id=r.id and status='pending';
  insert into public.billing_events(subscription_id,service_id,kind)values(r.id,s.id,'cancelled');return to_jsonb(r)-'provider_payment_reference'-'provider_customer_reference'-'provider_reference';
 elsif p_action='join' then
  if not s.enabled then raise exception 'service_disabled';end if;
  if s.payment_required then raise exception 'billing_not_configured';end if;
  insert into public.billing_subscriptions(account_id,service_id,first_amount,renewal_amount,interval_months,billing_mode,trial_days,status)values(p_account,s.id,s.first_amount,s.renewal_amount,s.interval_months,s.billing_mode,s.trial_days,'free')on conflict(account_id,service_id)do update set status='free',cancelled_at=null returning * into r;
  return to_jsonb(r)-'provider_payment_reference'-'provider_customer_reference'-'provider_reference';
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.billing_access(uuid,text),public.billing_manage(uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.billing_access(uuid,text),public.billing_manage(uuid,text,jsonb)to service_role;
create function public.finance_mail_request(p_account uuid,p_request text,p_filters jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.finance_accounts;r public.finance_mail_jobs;
begin
 select * into a from public.finance_accounts where id=p_account and enabled;
 if not found or not a.email_verified then raise exception 'email_not_verified';end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-mail:'||p_account::text,0));
 select * into r from public.finance_mail_jobs where account_id=p_account and request_id=p_request;if found then return to_jsonb(r)-'provider_payment_reference'-'provider_customer_reference'-'provider_reference';end if;
 if(select count(*)from public.finance_mail_jobs where account_id=p_account and created_at>now()-interval '1 day')>=10 then raise exception 'rate_limit';end if;
 if length(p_request)not between 16 and 150 then raise exception 'invalid_request';end if;
 insert into public.finance_mail_jobs(account_id,request_id,recipient,filters)values(p_account,p_request,a.email,p_filters)returning * into r;
 return to_jsonb(r)-'provider_payment_reference'-'provider_customer_reference'-'provider_reference';
end $$;
revoke all on function public.finance_mail_request(uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.finance_mail_request(uuid,text,jsonb)to service_role;
