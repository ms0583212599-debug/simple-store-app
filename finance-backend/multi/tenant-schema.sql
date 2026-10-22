create schema if not exists finance_private;
revoke all on schema finance_private from public,anon,authenticated;
do $$ begin if not exists(select 1 from pg_roles where rolname='finance_runtime') then create role finance_runtime nologin nobypassrls;end if;end $$;
grant finance_runtime to postgres;
grant usage on schema public,finance_private to finance_runtime;
grant create on schema finance_private to finance_runtime;
grant usage on schema finance_private to service_role;
create function finance_private.current_account()returns uuid language sql stable set search_path='' as $$ select nullif(current_setting('finance.account_id',true),'')::uuid $$;
revoke all on function finance_private.current_account() from public,anon,authenticated;
grant execute on function finance_private.current_account() to finance_runtime,service_role;
create table public.finance_accounts(id uuid primary key default gen_random_uuid(),phone text unique,display_name text not null default '',pin_hash text,enabled boolean not null default true,email text,email_verified boolean not null default false,created_at timestamptz not null default now());
alter table public.finance_accounts enable row level security;
revoke all on public.finance_accounts from anon,authenticated;
insert into public.finance_accounts(id,display_name)values('56ae10cb-f40c-4a41-8112-ab8c9f1616c8','החשבון שלי');
alter table public.finance_categories add column account_id uuid references public.finance_accounts(id);
update public.finance_categories set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_categories alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_categories_account_idx on public.finance_categories(account_id);
revoke all on public.finance_categories from anon,authenticated;
grant select,insert,update on public.finance_categories to finance_runtime;
create policy finance_categories_account on public.finance_categories to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_transactions add column account_id uuid references public.finance_accounts(id);
update public.finance_transactions set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_transactions alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_transactions_account_idx on public.finance_transactions(account_id);
revoke all on public.finance_transactions from anon,authenticated;
grant select,insert,update on public.finance_transactions to finance_runtime;
create policy finance_transactions_account on public.finance_transactions to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_recurring add column account_id uuid references public.finance_accounts(id);
update public.finance_recurring set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_recurring alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_recurring_account_idx on public.finance_recurring(account_id);
revoke all on public.finance_recurring from anon,authenticated;
grant select,insert,update on public.finance_recurring to finance_runtime;
create policy finance_recurring_account on public.finance_recurring to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_budgets add column account_id uuid references public.finance_accounts(id);
update public.finance_budgets set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_budgets alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_budgets_account_idx on public.finance_budgets(account_id);
revoke all on public.finance_budgets from anon,authenticated;
grant select,insert,update on public.finance_budgets to finance_runtime;
create policy finance_budgets_account on public.finance_budgets to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_audit add column account_id uuid references public.finance_accounts(id);
update public.finance_audit set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_audit alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_audit_account_idx on public.finance_audit(account_id);
revoke all on public.finance_audit from anon,authenticated;
grant select,insert,update on public.finance_audit to finance_runtime;
create policy finance_audit_account on public.finance_audit to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_requests add column account_id uuid references public.finance_accounts(id);
update public.finance_requests set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_requests alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_requests_account_idx on public.finance_requests(account_id);
revoke all on public.finance_requests from anon,authenticated;
grant select,insert,update on public.finance_requests to finance_runtime;
create policy finance_requests_account on public.finance_requests to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_calls add column account_id uuid references public.finance_accounts(id);
update public.finance_calls set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_calls alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_calls_account_idx on public.finance_calls(account_id);
revoke all on public.finance_calls from anon,authenticated;
grant select,insert,update on public.finance_calls to finance_runtime;
create policy finance_calls_account on public.finance_calls to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_ivr_sessions add column account_id uuid references public.finance_accounts(id);
update public.finance_ivr_sessions set account_id='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
alter table public.finance_ivr_sessions alter column account_id set not null,alter column account_id set default finance_private.current_account();
create index finance_ivr_sessions_account_idx on public.finance_ivr_sessions(account_id);
revoke all on public.finance_ivr_sessions from anon,authenticated;
grant select,insert,update on public.finance_ivr_sessions to finance_runtime;
create policy finance_ivr_sessions_account on public.finance_ivr_sessions to finance_runtime using(account_id=finance_private.current_account()) with check(account_id=finance_private.current_account());
alter table public.finance_categories drop constraint finance_categories_kind_dial_code_key,drop constraint finance_categories_kind_name_key,add unique(account_id,kind,dial_code),add unique(account_id,kind,name),add unique(account_id,id);
alter table public.finance_recurring add unique(account_id,id);
alter table public.finance_transactions add unique(account_id,id),add foreign key(account_id,category_id)references public.finance_categories(account_id,id),add foreign key(account_id,recurring_id)references public.finance_recurring(account_id,id),add foreign key(account_id,reversal_of)references public.finance_transactions(account_id,id);
alter table public.finance_recurring add foreign key(account_id,category_id)references public.finance_categories(account_id,id);
alter table public.finance_budgets add foreign key(account_id,category_id)references public.finance_categories(account_id,id);
grant usage,select on sequence public.finance_categories_id_seq to finance_runtime;
grant usage,select on sequence public.finance_transactions_id_seq to finance_runtime;
grant usage,select on sequence public.finance_recurring_id_seq to finance_runtime;
grant usage,select on sequence public.finance_budgets_id_seq to finance_runtime;
grant usage,select on sequence public.finance_audit_id_seq to finance_runtime;
create function finance_private.finance_category_save(p_id bigint,p_kind text,p_name text,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.finance_categories; n text:=btrim(p_name); code text;
begin
 if n is null or char_length(n)<1 or char_length(n)>60 or n ~ '[.=&<>[:cntrl:]]' or p_kind is null or p_kind not in ('income','expense') then raise exception 'invalid_category'; end if;
 perform pg_advisory_xact_lock(72396481);
 if exists(select 1 from public.finance_categories where kind=p_kind and lower(btrim(name))=lower(n) and (p_id is null or id<>p_id)) then raise exception 'duplicate_name'; end if;
 if p_id is null then
   select i::text into code from generate_series(1,9) i where not exists(select 1 from public.finance_categories where kind=p_kind and dial_code=i::text) order by i limit 1;
   if code is null then raise exception 'no_free_key'; end if;
   insert into public.finance_categories(kind,name,dial_code) values(p_kind,n,code) returning * into v;
 else
   select * into v from public.finance_categories where id=p_id for update;
   if not found then raise exception 'category_missing'; end if;
   if v.kind<>p_kind then raise exception 'kind_locked'; end if;
   if p_revision is null or v.revision<>p_revision then raise exception 'category_changed'; end if;
   update public.finance_categories set name=n,revision=revision+1 where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end $$;
alter function finance_private.finance_category_save(bigint,text,text,integer) owner to finance_runtime;
revoke all on function finance_private.finance_category_save(bigint,text,text,integer) from public,anon,authenticated;
grant execute on function finance_private.finance_category_save(bigint,text,text,integer) to service_role,finance_runtime;
create or replace function public.finance_category_save(p_id bigint,p_kind text,p_name text,p_revision integer)returns jsonb language plpgsql security invoker set search_path='' as $$ begin perform set_config('finance.account_id','56ae10cb-f40c-4a41-8112-ab8c9f1616c8',true); return finance_private.finance_category_save(p_id,p_kind,p_name,p_revision);end $$;
create function finance_private.finance_materialize(p_from date,p_to date) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>1100 then raise exception 'invalid_range';end if;
 insert into public.finance_transactions(kind,category_id,amount_agorot,occurred_on,note,flow_type,status,payment_method,recurring_id,recurring_month)
 select r.kind,r.category_id,r.amount_agorot,
 (m::date+ (least(r.due_day,extract(day from (m+interval '1 month -1 day'))::int)-1)),r.name,'fixed','planned',r.payment_method,r.id,m::date
 from public.finance_recurring r cross join lateral generate_series(date_trunc('month',greatest(p_from,r.start_month)),date_trunc('month',least(p_to,coalesce(r.end_month,p_to))),interval '1 month') m
 where r.active and r.start_month<=p_to and (r.end_month is null or r.end_month>=date_trunc('month',p_from)::date)
 on conflict do nothing;
end $$;
alter function finance_private.finance_materialize(date,date) owner to finance_runtime;
revoke all on function finance_private.finance_materialize(date,date) from public,anon,authenticated;
grant execute on function finance_private.finance_materialize(date,date) to service_role,finance_runtime;
create or replace function public.finance_materialize(p_from date,p_to date)returns void language plpgsql security invoker set search_path='' as $$ begin perform set_config('finance.account_id','56ae10cb-f40c-4a41-8112-ab8c9f1616c8',true); perform finance_private.finance_materialize(p_from,p_to);end $$;
create function finance_private.finance_manage(p_action text,p_data jsonb,p_request text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.finance_transactions; oldt public.finance_transactions;r public.finance_recurring; b public.finance_budgets;
 result jsonb; k text; cat bigint; amount bigint; typ text; dt date; method text; stat text; n text; rid bigint; ver integer; rev bigint; total bigint; inst integer; i integer; grp text; today date:=(now() at time zone 'Asia/Jerusalem')::date;
begin
 p_request:=finance_private.current_account()::text||':'||p_request;
 if p_request is null or length(p_request) not between 16 and 150 then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(72396482);
 select x.result into result from public.finance_requests x where request_id=p_request;
 if found then return result;end if;
 if p_action='category_save' then
  result:=finance_private.finance_category_save(nullif(p_data->>'id','')::bigint,p_data->>'kind',p_data->>'name',nullif(p_data->>'revision','')::int);
 elsif p_action in ('transaction_save','refund','installments') then
  rid:=nullif(p_data->>'id','')::bigint;
  if rid is not null then
   select * into oldt from public.finance_transactions where id=rid for update;
   if not found then raise exception 'not_found';end if;
   if oldt.revision<>coalesce((p_data->>'revision')::int,0) then raise exception 'changed';end if;
   if oldt.voided_at is not null then raise exception 'voided';end if;
  end if;
  k:=p_data->>'kind';cat:=(p_data->>'category_id')::bigint;amount:=(p_data->>'amount_agorot')::bigint;typ:=p_data->>'flow_type';dt:=(p_data->>'occurred_on')::date;method:=coalesce(p_data->>'payment_method','unspecified');stat:=coalesce(p_data->>'status','actual');n:=coalesce(p_data->>'note','');
  rev:=case when p_action='refund' then (p_data->>'reversal_of')::bigint else oldt.reversal_of end;
  if rev is not null then
   select * into t from public.finance_transactions where id=rev for update;
   if not found or t.voided_at is not null or t.status<>'actual' or t.reversal_of is not null then raise exception 'invalid_refund';end if;
   k:=t.kind;cat:=t.category_id;typ:=t.flow_type;stat:='actual';
   select coalesce(sum(amount_agorot),0) into total from public.finance_transactions where reversal_of=rev and voided_at is null and (rid is null or id<>rid);
   if amount+total>t.amount_agorot then raise exception 'refund_exceeds';end if;
  end if;
  if k is null or k not in ('income','expense') or typ is null or typ not in ('current','fixed','exceptional','annual') or amount is null or amount not between 1 and 99999999 or dt is null or dt<date '2000-01-01' or dt>today+interval '10 years' or length(n)>500 or stat not in ('planned','actual') or method not in ('unspecified','cash','bank','credit') then raise exception 'invalid_fields';end if;
  if stat='actual' and dt>today then raise exception 'future_actual';end if;
  if not exists(select 1 from public.finance_categories where id=cat and kind=k and active) then raise exception 'invalid_category';end if;
  if rid is not null then
   if k<>oldt.kind then raise exception 'kind_locked';end if;
   if oldt.recurring_id is not null and typ<>'fixed' then raise exception 'recurring_month_locked';end if;
   if exists(select 1 from public.finance_transactions where reversal_of=rid and voided_at is null) and (k<>oldt.kind or cat<>oldt.category_id or typ<>oldt.flow_type or amount<>oldt.amount_agorot or stat<>'actual') then raise exception 'has_refunds';end if;
   update public.finance_transactions set category_id=cat,amount_agorot=amount,flow_type=typ,occurred_on=dt,note=n,payment_method=method,status=stat,revision=revision+1 where id=rid returning * into t;
   result:=to_jsonb(t);
  elsif p_action='installments' then
   inst:=(p_data->>'installment_count')::int;
   if inst is null or inst not between 2 and 60 or amount<inst then raise exception 'invalid_installments';end if;
   grp:=p_request;
   for i in 0..inst-1 loop
    insert into public.finance_transactions(kind,category_id,amount_agorot,occurred_on,note,flow_type,status,payment_method,installment_group,installment_number,installment_count)
    values(k,cat,amount/inst+case when i<amount%inst then 1 else 0 end,(dt+make_interval(months=>i))::date,n,typ,'planned',method,grp,i+1,inst);
   end loop;
   result:=jsonb_build_object('installment_group',grp,'count',inst);
  else
   insert into public.finance_transactions(kind,category_id,amount_agorot,occurred_on,note,flow_type,status,payment_method,reversal_of,external_request_id)
   values(k,cat,amount,dt,n,typ,stat,method,rev,p_request) returning * into t;result:=to_jsonb(t);
  end if;
 elsif p_action in ('void','restore','mark_actual') then
  select * into t from public.finance_transactions where id=(p_data->>'id')::bigint for update;
  if not found then raise exception 'not_found';end if;
  if t.revision<>coalesce((p_data->>'revision')::int,0) then raise exception 'changed';end if;
  if exists(select 1 from public.finance_transactions where reversal_of=t.id and voided_at is null) then raise exception 'has_refunds';end if;
  if p_action='mark_actual' then
   if t.voided_at is not null then raise exception 'voided';end if;
   dt:=coalesce(nullif(p_data->>'occurred_on','')::date,today);
   if dt>today or dt<date '2000-01-01' then raise exception 'invalid_date';end if;
   update public.finance_transactions set status='actual',occurred_on=dt,revision=revision+1 where id=t.id returning * into t;
  else
   if p_action='restore' and t.reversal_of is not null then
    select amount_agorot into amount from public.finance_transactions where id=t.reversal_of and voided_at is null;
    select coalesce(sum(amount_agorot),0) into total from public.finance_transactions where reversal_of=t.reversal_of and voided_at is null and id<>t.id;
    if amount is null or total+t.amount_agorot>amount then raise exception 'refund_exceeds';end if;
   end if;
   update public.finance_transactions set voided_at=case when p_action='void' then now() else null end,system_void=false,revision=revision+1 where id=t.id returning * into t;
  end if;result:=to_jsonb(t);
 elsif p_action='recurring_save' then
  rid:=nullif(p_data->>'id','')::bigint;k:=p_data->>'kind';cat:=(p_data->>'category_id')::bigint;amount:=(p_data->>'amount_agorot')::bigint;n:=btrim(p_data->>'name');i:=(p_data->>'due_day')::int;dt:=date_trunc('month',(p_data->>'start_month')::date)::date;method:=coalesce(p_data->>'payment_method','unspecified');
  if k is null or k not in ('income','expense') or n is null or length(n) not between 1 and 80 or amount is null or amount not between 1 and 99999999 or i is null or i not between 1 and 31 or dt is null or dt<date '2000-01-01' or dt>today+interval '10 years' or method not in ('cash','bank','credit','unspecified') then raise exception 'invalid_fields';end if;
  if not exists(select 1 from public.finance_categories where id=cat and kind=k and active) then raise exception 'invalid_category';end if;
  if rid is null then insert into public.finance_recurring(kind,category_id,name,amount_agorot,due_day,start_month,payment_method) values(k,cat,n,amount,i,dt,method) returning * into r;
  else
   select * into r from public.finance_recurring where id=rid for update;
   if not found then raise exception 'not_found';end if;
   if r.revision<>coalesce((p_data->>'revision')::int,0) then raise exception 'changed';end if;
   if r.kind<>k or r.start_month<>dt then raise exception 'kind_locked';end if;
   update public.finance_recurring set category_id=cat,name=n,amount_agorot=amount,due_day=i,payment_method=method,active=coalesce((p_data->>'active')::boolean,true),revision=revision+1 where id=rid returning * into r;
   update public.finance_transactions set category_id=cat,note=n,amount_agorot=amount,payment_method=method,
    occurred_on=(recurring_month+least(i,extract(day from(recurring_month+interval '1 month -1 day'))::int)-1),
    voided_at=case when not r.active then now() when system_void then null else voided_at end,system_void=not r.active,revision=revision+1
    where recurring_id=rid and status='planned' and (voided_at is null or system_void) and recurring_month>=date_trunc('month',today)::date;
  end if;
  perform finance_private.finance_materialize(today,(date_trunc('month',today)+interval '1 month -1 day')::date);result:=to_jsonb(r);
 elsif p_action='budget_save' then
  cat:=(p_data->>'category_id')::bigint;amount:=(p_data->>'amount_agorot')::bigint;dt:=date_trunc('month',(p_data->>'month')::date)::date;
  if dt is null or amount is null or amount<0 or amount>99999999 or not exists(select 1 from public.finance_categories where id=cat and kind='expense') then raise exception 'invalid_fields';end if;
  select * into b from public.finance_budgets where category_id=cat and month=dt for update;
  if found then
   if b.revision<>coalesce((p_data->>'revision')::int,0) then raise exception 'changed';end if;
   update public.finance_budgets set amount_agorot=amount,revision=revision+1 where id=b.id returning * into b;
  else insert into public.finance_budgets(category_id,month,amount_agorot)values(cat,dt,amount)returning * into b;end if;result:=to_jsonb(b);
 else raise exception 'unknown_action';end if;
 insert into public.finance_requests(request_id,result) values(p_request,result);
 return result;
end $$;
alter function finance_private.finance_manage(text,jsonb,text) owner to finance_runtime;
revoke all on function finance_private.finance_manage(text,jsonb,text) from public,anon,authenticated;
grant execute on function finance_private.finance_manage(text,jsonb,text) to service_role,finance_runtime;
create or replace function public.finance_manage(p_action text,p_data jsonb,p_request text)returns jsonb language plpgsql security invoker set search_path='' as $$ begin perform set_config('finance.account_id','56ae10cb-f40c-4a41-8112-ab8c9f1616c8',true); return finance_private.finance_manage(p_action,p_data,p_request);end $$;
create function finance_private.finance_read(p_data jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare a date:=(p_data->>'from')::date;b date:=(p_data->>'to')::date; result jsonb; mode text:=coalesce(p_data->>'mode','report');
begin
 if mode='categories' then return (select jsonb_build_object('rows',coalesce(jsonb_agg(c order by kind,dial_code),'[]'))from public.finance_categories c);end if;
 if mode='history' then return (select jsonb_build_object('rows',coalesce(jsonb_agg(h order by id desc),'[]'))from(select * from public.finance_audit where entity=coalesce(p_data->>'entity','finance_transactions')and entity_id=(p_data->>'id')::bigint order by id desc limit 30)h);end if;
 if mode='item' then return (select to_jsonb(t)||jsonb_build_object('category_name',c.name)from public.finance_transactions t join public.finance_categories c on c.id=t.category_id where t.id=(p_data->>'id')::bigint);end if;
 if mode='recurring' then return(select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('category_name',c.name) order by r.id),'[]'))from public.finance_recurring r join public.finance_categories c on c.id=r.category_id where (nullif(p_data->>'kind','')is null or r.kind=p_data->>'kind'));end if;
 if a is null or b is null or b<a or b-a>36525 then raise exception 'invalid_range';end if;
 if b-a>1100 then
 perform finance_private.finance_materialize(g::date,least(b,(g+interval '35 months -1 day')::date))from generate_series(a,b,interval '35 months')g;
 else perform finance_private.finance_materialize(a,b);end if;
 with filtered as materialized(
 select t.*,c.name category_name,case when reversal_of is null then amount_agorot else -amount_agorot end signed_amount
 from public.finance_transactions t join public.finance_categories c on c.id=t.category_id
 where t.occurred_on between a and b
 and(nullif(p_data->>'kind','')is null or t.kind=p_data->>'kind')
 and(nullif(p_data->>'flow_type','')is null or t.flow_type=p_data->>'flow_type')
 and(nullif(p_data->>'category_id','')is null or t.category_id=(p_data->>'category_id')::bigint)
 and(nullif(p_data->>'amount_agorot','')is null or t.amount_agorot=(p_data->>'amount_agorot')::bigint)
 and(nullif(p_data->>'status','')is null or t.status=p_data->>'status')
 and(nullif(p_data->>'search','')is null or strpos(lower(t.note||' '||c.name||' '||t.id::text),lower(p_data->>'search'))>0)
 ), valid as(select * from filtered where voided_at is null),
 groups as(select flow_type,coalesce(sum(signed_amount)filter(where kind='income'and status='actual'),0)income,coalesce(sum(signed_amount)filter(where kind='expense'and status='actual'),0)expense,coalesce(sum(signed_amount)filter(where kind='income'and status='planned'),0)planned_income,coalesce(sum(signed_amount)filter(where kind='expense'and status='planned'),0)planned_expense from valid group by flow_type),
 cats as(select category_name,kind,sum(signed_amount)filter(where status='actual')actual,sum(signed_amount)filter(where status='planned')planned from valid group by category_name,kind),
 rows as(select * from filtered where coalesce((p_data->>'include_voided')::boolean,false)or voided_at is null order by occurred_on desc,id desc limit 50 offset greatest(0,least(coalesce((p_data->>'page')::int,0),100000))*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(r)from rows r),'[]'),
 'total',(select count(*)from filtered where coalesce((p_data->>'include_voided')::boolean,false)or voided_at is null),
 'income',coalesce((select sum(signed_amount)from valid where kind='income'and status='actual'),0),
 'expense',coalesce((select sum(signed_amount)from valid where kind='expense'and status='actual'),0),
 'planned_income',coalesce((select sum(signed_amount)from valid where kind='income'and status='planned'),0),
 'planned_expense',coalesce((select sum(signed_amount)from valid where kind='expense'and status='planned'),0),
 'groups',coalesce((select jsonb_agg(g)from groups g),'[]'),
 'by_category',coalesce((select jsonb_agg(c)from cats c),'[]'),
 'budgets',coalesce((select jsonb_agg(to_jsonb(bu)||jsonb_build_object('category_name',c.name,'spent',coalesce((select sum(case when reversal_of is null then t.amount_agorot else -t.amount_agorot end)from public.finance_transactions t where t.category_id=bu.category_id and t.kind='expense'and t.status='actual'and t.voided_at is null and t.occurred_on>=bu.month and t.occurred_on<(bu.month+interval '1 month')),0)))from public.finance_budgets bu join public.finance_categories c on c.id=bu.category_id where bu.month=date_trunc('month',a)::date),'[]')) into result;
 return result;
end $$;
alter function finance_private.finance_read(jsonb) owner to finance_runtime;
revoke all on function finance_private.finance_read(jsonb) from public,anon,authenticated;
grant execute on function finance_private.finance_read(jsonb) to service_role,finance_runtime;
create or replace function public.finance_read(p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$ begin perform set_config('finance.account_id','56ae10cb-f40c-4a41-8112-ab8c9f1616c8',true); return finance_private.finance_read(p_data);end $$;
create function finance_private.finance_call(p_id text,p_seq integer,p_state jsonb,p_response text)returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.finance_calls;
begin
 p_id:=finance_private.current_account()::text||':'||p_id;
 if p_state is not null then
  if p_seq=-1 then insert into public.finance_calls(id,state,response)values(p_id,p_state,p_response)on conflict do nothing;
  else update public.finance_calls set state=p_state,response=p_response,seq=seq+1,updated_at=now()where id=p_id and seq=p_seq;end if;
 end if;
 select * into r from public.finance_calls where id=p_id;return to_jsonb(r);
end $$;
alter function finance_private.finance_call(text,integer,jsonb,text) owner to finance_runtime;
revoke all on function finance_private.finance_call(text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function finance_private.finance_call(text,integer,jsonb,text) to service_role,finance_runtime;
create or replace function public.finance_call(p_id text,p_seq integer,p_state jsonb,p_response text)returns jsonb language plpgsql security invoker set search_path='' as $$ begin perform set_config('finance.account_id','56ae10cb-f40c-4a41-8112-ab8c9f1616c8',true); return finance_private.finance_call(p_id,p_seq,p_state,p_response);end $$;
create function public.finance_scoped(p_account uuid,p_action text,p_data jsonb,p_request text default null)returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.finance_accounts where id=p_account and enabled)then raise exception 'account_disabled';end if;
 perform set_config('finance.account_id',p_account::text,true);
 if p_action='read' then return finance_private.finance_read(p_data);
 elsif p_action='call' then return finance_private.finance_call(p_data->>'id',(p_data->>'seq')::int,nullif(p_data->'state','null'::jsonb),p_data->>'response');
 else return finance_private.finance_manage(p_action,p_data,p_request);end if;
end $$;
revoke all on function public.finance_scoped(uuid,text,jsonb,text)from public,anon,authenticated;
grant execute on function public.finance_scoped(uuid,text,jsonb,text)to service_role;
create or replace function public.finance_audit_trigger() returns trigger language plpgsql security invoker set search_path='' as $$ begin insert into public.finance_audit(account_id,entity,entity_id,before_data,after_data) values(NEW.account_id,TG_TABLE_NAME,NEW.id,case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,to_jsonb(NEW)); return NEW; end $$;
