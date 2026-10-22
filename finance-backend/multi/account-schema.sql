create table public.finance_sessions(token_hash text primary key,account_id uuid not null references public.finance_accounts(id),channel text not null,expires_at timestamptz not null,created_at timestamptz not null default now());
create table public.finance_challenges(id uuid primary key default gen_random_uuid(),phone text not null,code_hash text not null,purpose text not null,account_id uuid references public.finance_accounts(id),expires_at timestamptz not null,attempts int not null default 0,used_at timestamptz,created_at timestamptz not null default now());
create index finance_challenges_phone_time on public.finance_challenges(phone,created_at);
create table public.finance_auth_limits(key text primary key,window_start timestamptz not null default now(),attempts int not null default 0);
create table public.finance_integrations(id boolean primary key default true check(id),bridge_secret text not null,bridge_url text not null,mail_enabled boolean not null default false,voice_enabled boolean not null default false);
create table public.billing_services(id uuid primary key default gen_random_uuid(),slug text unique not null check(slug~'^[a-z][a-z0-9_-]{1,39}$'),name text not null check(length(name)between 1 and 80),enabled boolean not null default true,payment_required boolean not null default false,first_amount integer not null default 300 check(first_amount between 0 and 10000000),renewal_amount integer not null default 1000 check(renewal_amount between 0 and 10000000),interval_months integer not null default 1 check(interval_months between 1 and 12),billing_mode text not null default 'recurring' check(billing_mode in ('recurring','one_time')),trial_days integer not null default 0 check(trial_days between 0 and 365),revision integer not null default 1,provider_ready boolean not null default false,created_at timestamptz not null default now());
insert into public.billing_services(slug,name)values('finance','ניהול כלכלה');
create table public.billing_subscriptions(id uuid primary key default gen_random_uuid(),account_id uuid not null references public.finance_accounts(id),service_id uuid not null references public.billing_services(id),status text not null default 'free' check(status in ('free','pending','active','past_due','cancelled')),first_amount integer not null,renewal_amount integer not null,interval_months integer not null,billing_mode text not null,trial_days integer not null default 0,consent_at timestamptz,consent_version integer,provider_reference text,period_start timestamptz,paid_until timestamptz,cancelled_at timestamptz,created_at timestamptz not null default now(),unique(account_id,service_id));
create table public.billing_events(id bigint generated always as identity primary key,subscription_id uuid references public.billing_subscriptions(id),service_id uuid references public.billing_services(id),kind text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.billing_charges(id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.billing_subscriptions(id),period_start timestamptz not null,amount integer not null check(amount>=0),status text not null default 'pending' check(status in ('pending','processing','succeeded','failed','cancelled','unknown')),provider_reference text,created_at timestamptz not null default now(),unique(subscription_id,period_start));
create table public.finance_mail_jobs(id uuid primary key default gen_random_uuid(),account_id uuid not null references public.finance_accounts(id),request_id text not null,recipient text not null,filters jsonb not null,status text not null default 'pending' check(status in ('pending','sending','sent','failed')),provider_reference text,created_at timestamptz not null default now(),sent_at timestamptz,unique(account_id,request_id));
create table public.finance_email_challenges(id uuid primary key default gen_random_uuid(),account_id uuid not null references public.finance_accounts(id),email text not null,code_hash text not null,attempts int not null default 0,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now());
create table public.finance_entry_calls(id text primary key,phone text not null,state jsonb not null default '{}',seq int not null default 0,response text,account_id uuid references public.finance_accounts(id),authenticated_until timestamptz,updated_at timestamptz not null default now());
do $$ declare t text;begin foreach t in array array['finance_sessions','finance_challenges','finance_auth_limits','finance_integrations','billing_services','billing_subscriptions','billing_events','billing_charges','finance_mail_jobs','finance_email_challenges','finance_entry_calls'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end $$;
create function public.finance_account_auth(p_action text,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.finance_accounts;c public.finance_challenges;s public.finance_sessions;v text;k text;lim public.finance_auth_limits;code text;tok text;result jsonb;mode text:=coalesce(p_data->>'purpose','register');
begin
 if p_action='resolve' then
 select * into s from public.finance_sessions where token_hash=encode(extensions.digest(p_data->>'token','sha256'),'hex')and expires_at>now();
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.finance_accounts where id=s.account_id and enabled;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 return jsonb_build_object('account_id',a.id,'phone',a.phone,'display_name',a.display_name,'email',a.email,'email_verified',a.email_verified);
 elsif p_action='logout' then delete from public.finance_sessions where token_hash=encode(extensions.digest(p_data->>'token','sha256'),'hex');return '{"ok":true}'::jsonb;
 end if;
 v:=p_data->>'phone';if v is null or v!~'^0[2-9][0-9]{7,8}$' then return '{"error":"invalid_phone"}'::jsonb;end if;
 perform pg_advisory_xact_lock(hashtextextended('finance-auth:'||v,0));
 k:=case when p_action='login' then 'login:' else 'otp:' end||v;
 insert into public.finance_auth_limits(key)values(k)on conflict do nothing;
 select * into lim from public.finance_auth_limits where key=k for update;
 if lim.window_start<now()-interval '15 minutes' then update public.finance_auth_limits set window_start=now(),attempts=0 where key=k returning * into lim;end if;
 if lim.attempts>=8 then return '{"error":"rate_limit"}'::jsonb;end if;
 update public.finance_auth_limits set attempts=attempts+1 where key=k;
 if p_action='challenge' then
  if mode not in ('register','reset','link')then return '{"error":"invalid_action"}'::jsonb;end if;
  if exists(select 1 from public.finance_challenges where phone=v and created_at>now()-interval '60 seconds')then return '{"error":"cooldown"}'::jsonb;end if;
  code:=p_data->>'code';if code!~'^\d{6}$' then return '{"error":"invalid_code"}'::jsonb;end if;
  insert into public.finance_challenges(phone,code_hash,purpose,account_id,expires_at)values(v,encode(extensions.digest(code,'sha256'),'hex'),mode,case when mode='link' then (p_data->>'account_id')::uuid else null end,now()+interval '10 minutes')returning * into c;
  return jsonb_build_object('challenge_id',c.id,'expires_at',c.expires_at);
 elsif p_action='verify' then
  select * into c from public.finance_challenges where id=(p_data->>'challenge_id')::uuid and phone=v for update;
  if not found or c.used_at is not null or c.expires_at<now()or c.attempts>=5 then return '{"error":"invalid_code"}'::jsonb;end if;
  update public.finance_challenges set attempts=attempts+1 where id=c.id;
  if c.code_hash<>encode(extensions.digest(p_data->>'code','sha256'),'hex') then return '{"error":"invalid_code"}'::jsonb;end if;
  if coalesce(p_data->>'pin','')!~'^\d{6,12}$' then return '{"error":"invalid_pin"}'::jsonb;end if;
  select * into a from public.finance_accounts where phone=v;
  if c.purpose='link' then
   if a.id is not null and a.id<>c.account_id then return '{"error":"phone_in_use"}'::jsonb;end if;
   update public.finance_accounts set phone=v,pin_hash=extensions.crypt(p_data->>'pin',extensions.gen_salt('bf',10))where id=c.account_id and enabled returning * into a;
  elsif c.purpose='register' then
   if a.id is not null then return '{"error":"already_registered"}'::jsonb;end if;
   insert into public.finance_accounts(phone,pin_hash,display_name)values(v,extensions.crypt(p_data->>'pin',extensions.gen_salt('bf',10)),left(coalesce(p_data->>'name',''),80))returning * into a;
   insert into public.finance_categories(account_id,kind,name,dial_code)values(a.id,'income','משכורת','1'),(a.id,'income','החזרים','2'),(a.id,'income','אחר','3'),(a.id,'expense','מזון וקניות','1'),(a.id,'expense','דיור','2'),(a.id,'expense','חשבונות','3'),(a.id,'expense','תחבורה','4'),(a.id,'expense','בריאות','5'),(a.id,'expense','אחר','6');
  else
   if a.id is null or not a.enabled then return '{"error":"unauthorized"}'::jsonb;end if;
   update public.finance_accounts set pin_hash=extensions.crypt(p_data->>'pin',extensions.gen_salt('bf',10))where id=a.id returning * into a;
  end if;
  if a.id is null or not a.enabled then return '{"error":"unauthorized"}'::jsonb;end if;
  update public.finance_challenges set used_at=now()where id=c.id;
  delete from public.finance_sessions where account_id=a.id;
 elsif p_action='login' then
  select * into a from public.finance_accounts where phone=v and enabled;
  if a.id is null or a.pin_hash is null or coalesce(p_data->>'pin','')!~'^\d{6,12}$' or extensions.crypt(p_data->>'pin',a.pin_hash)<>a.pin_hash then return '{"error":"unauthorized"}'::jsonb;end if;
 else return '{"error":"invalid_action"}'::jsonb;
 end if;
 tok:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.finance_sessions(token_hash,account_id,channel,expires_at)values(encode(extensions.digest(tok,'sha256'),'hex'),a.id,coalesce(p_data->>'channel','web'),now()+interval '1 hour');
 insert into public.billing_subscriptions(account_id,service_id,first_amount,renewal_amount,interval_months,billing_mode,trial_days,status)select a.id,id,first_amount,renewal_amount,interval_months,billing_mode,trial_days,case when payment_required then 'pending' else 'free' end from public.billing_services where slug='finance' on conflict do nothing;
 return jsonb_build_object('token',tok,'account_id',a.id,'expires_in',3600);
end $$;
revoke all on function public.finance_account_auth(text,jsonb)from public,anon,authenticated;
grant execute on function public.finance_account_auth(text,jsonb)to service_role;
create function public.finance_profile(p_account uuid,p_action text,p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.finance_accounts;c public.finance_email_challenges;v text;
begin
 select * into a from public.finance_accounts where id=p_account and enabled;if not found then raise exception 'unauthorized';end if;
 if p_action='get' then return to_jsonb(a)-'pin_hash';
 elsif p_action='name' then update public.finance_accounts set display_name=left(btrim(p_data->>'name'),80)where id=a.id;return '{"ok":true}'::jsonb;
 elsif p_action='email_start' then
 v:=lower(btrim(p_data->>'email'));if v is null or length(v)>254 or v!~'^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then return '{"error":"invalid_email"}'::jsonb;end if;
 if exists(select 1 from public.finance_email_challenges where account_id=a.id and created_at>now()-interval '60 seconds')then return '{"error":"cooldown"}'::jsonb;end if;
 if(select count(*)from public.finance_email_challenges where account_id=a.id and created_at>now()-interval '1 day')>=10 then return '{"error":"rate_limit"}'::jsonb;end if;
 insert into public.finance_email_challenges(account_id,email,code_hash,expires_at)values(a.id,v,encode(extensions.digest(p_data->>'code','sha256'),'hex'),now()+interval '15 minutes')returning * into c;
 return jsonb_build_object('challenge_id',c.id,'email',c.email);
 elsif p_action='email_verify' then
 select * into c from public.finance_email_challenges where id=(p_data->>'challenge_id')::uuid and account_id=a.id for update;
 if not found or c.used_at is not null or c.expires_at<now()or c.attempts>=5 then return '{"error":"invalid_code"}'::jsonb;end if;
 update public.finance_email_challenges set attempts=attempts+1 where id=c.id;
 if c.code_hash<>encode(extensions.digest(p_data->>'code','sha256'),'hex')then return '{"error":"invalid_code"}'::jsonb;end if;
 update public.finance_accounts set email=c.email,email_verified=true where id=a.id;
 update public.finance_email_challenges set used_at=now()where id=c.id;return '{"ok":true}'::jsonb;
 end if;raise exception 'invalid_action';
end $$;
revoke all on function public.finance_profile(uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.finance_profile(uuid,text,jsonb)to service_role;
