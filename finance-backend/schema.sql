alter table public.finance_transactions drop constraint finance_transactions_flow_type_check;
alter table public.finance_transactions add constraint finance_transactions_flow_type_check check(flow_type in ('current','fixed','exceptional','annual'));
alter table public.finance_transactions add column status text not null default 'actual' check(status in ('planned','actual')),
 add column revision integer not null default 1,
 add column payment_method text not null default 'unspecified' check(payment_method in ('unspecified','cash','bank','credit')),
 add column recurring_id bigint,
 add column recurring_month date,
 add column system_void boolean not null default false,
 add column reversal_of bigint references public.finance_transactions(id),
 add column installment_group text,
 add column installment_number integer,
 add column installment_count integer;
create index finance_transactions_reversal_idx on public.finance_transactions(reversal_of);
create table public.finance_recurring(
 id bigint generated always as identity primary key,kind text not null check(kind in ('income','expense')),
 category_id bigint not null references public.finance_categories(id),name text not null check(length(name) between 1 and 80),
 amount_agorot bigint not null check(amount_agorot between 1 and 99999999),due_day integer not null check(due_day between 1 and 31),
 start_month date not null,end_month date,active boolean not null default true,
 payment_method text not null default 'unspecified' check(payment_method in ('unspecified','cash','bank','credit')),
 revision integer not null default 1,created_at timestamptz not null default now(),check(end_month is null or end_month>=start_month));
alter table public.finance_recurring enable row level security;
alter table public.finance_transactions add foreign key(recurring_id) references public.finance_recurring(id);
create unique index finance_recurring_occurrence on public.finance_transactions(recurring_id,recurring_month) where recurring_id is not null;
create index finance_recurring_category_idx on public.finance_recurring(category_id);
create table public.finance_budgets(id bigint generated always as identity primary key,month date not null,category_id bigint not null references public.finance_categories(id),amount_agorot bigint not null check(amount_agorot>=0 and amount_agorot<=99999999),revision integer not null default 1,unique(month,category_id));
alter table public.finance_budgets enable row level security;
create index finance_budgets_category_idx on public.finance_budgets(category_id);
create table public.finance_audit(id bigint generated always as identity primary key,entity text not null,entity_id bigint not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());
alter table public.finance_audit enable row level security;
create index finance_audit_entity_idx on public.finance_audit(entity,entity_id,id);
create table public.finance_requests(request_id text primary key,result jsonb not null,created_at timestamptz not null default now());
alter table public.finance_requests enable row level security;
create table public.finance_calls(id text primary key,state jsonb not null,seq integer not null default 0,response text not null,updated_at timestamptz not null default now());
alter table public.finance_calls enable row level security;
create function public.finance_audit_trigger() returns trigger language plpgsql security invoker set search_path='' as $$ begin insert into public.finance_audit(entity,entity_id,before_data,after_data) values(TG_TABLE_NAME,NEW.id,case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,to_jsonb(NEW)); return NEW; end $$;
revoke all on function public.finance_audit_trigger() from public,anon,authenticated;
create trigger finance_transaction_audit after insert or update on public.finance_transactions for each row execute function public.finance_audit_trigger();
create trigger finance_recurring_audit after insert or update on public.finance_recurring for each row execute function public.finance_audit_trigger();
create trigger finance_budget_audit after insert or update on public.finance_budgets for each row execute function public.finance_audit_trigger();
create trigger finance_category_audit after insert or update on public.finance_categories for each row execute function public.finance_audit_trigger();

create function public.finance_materialize(p_from date,p_to date) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>1100 then raise exception 'invalid_range';end if;
 insert into public.finance_transactions(kind,category_id,amount_agorot,occurred_on,note,flow_type,status,payment_method,recurring_id,recurring_month)
 select r.kind,r.category_id,r.amount_agorot,
 (m::date+ (least(r.due_day,extract(day from (m+interval '1 month -1 day'))::int)-1)),r.name,'fixed','planned',r.payment_method,r.id,m::date
 from public.finance_recurring r cross join lateral generate_series(date_trunc('month',greatest(p_from,r.start_month)),date_trunc('month',least(p_to,coalesce(r.end_month,p_to))),interval '1 month') m
 where r.active and r.start_month<=p_to and (r.end_month is null or r.end_month>=date_trunc('month',p_from)::date)
 on conflict do nothing;
end $$;
revoke all on function public.finance_materialize(date,date) from public,anon,authenticated;
grant execute on function public.finance_materialize(date,date) to service_role;

create function public.finance_manage(p_action text,p_data jsonb,p_request text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.finance_transactions; oldt public.finance_transactions;r public.finance_recurring; b public.finance_budgets;
 result jsonb; k text; cat bigint; amount bigint; typ text; dt date; method text; stat text; n text; rid bigint; ver integer; rev bigint; total bigint; inst integer; i integer; grp text; today date:=(now() at time zone 'Asia/Jerusalem')::date;
begin
 if p_request is null or length(p_request) not between 16 and 150 then raise exception 'invalid_request';end if;
 perform pg_advisory_xact_lock(72396482);
 select x.result into result from public.finance_requests x where request_id=p_request;
 if found then return result;end if;
 if p_action='category_save' then
  result:=public.finance_category_save(nullif(p_data->>'id','')::bigint,p_data->>'kind',p_data->>'name',nullif(p_data->>'revision','')::int);
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
  perform public.finance_materialize(today,(date_trunc('month',today)+interval '1 month -1 day')::date);result:=to_jsonb(r);
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
revoke all on function public.finance_manage(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.finance_manage(text,jsonb,text) to service_role;

create function public.finance_read(p_data jsonb)returns jsonb language plpgsql security invoker set search_path='' as $$
declare a date:=(p_data->>'from')::date;b date:=(p_data->>'to')::date; result jsonb; mode text:=coalesce(p_data->>'mode','report');
begin
 if mode='categories' then return (select jsonb_build_object('rows',coalesce(jsonb_agg(c order by kind,dial_code),'[]'))from public.finance_categories c);end if;
 if mode='history' then return (select jsonb_build_object('rows',coalesce(jsonb_agg(h order by id desc),'[]'))from(select * from public.finance_audit where entity=coalesce(p_data->>'entity','finance_transactions')and entity_id=(p_data->>'id')::bigint order by id desc limit 30)h);end if;
 if mode='item' then return (select to_jsonb(t)||jsonb_build_object('category_name',c.name)from public.finance_transactions t join public.finance_categories c on c.id=t.category_id where t.id=(p_data->>'id')::bigint);end if;
 if mode='recurring' then return(select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('category_name',c.name) order by r.id),'[]'))from public.finance_recurring r join public.finance_categories c on c.id=r.category_id where (nullif(p_data->>'kind','')is null or r.kind=p_data->>'kind'));end if;
 if a is null or b is null or b<a or b-a>1100 then raise exception 'invalid_range';end if;
 perform public.finance_materialize(a,b);
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
revoke all on function public.finance_read(jsonb) from public,anon,authenticated;
grant execute on function public.finance_read(jsonb) to service_role;

create function public.finance_call(p_id text,p_seq integer,p_state jsonb,p_response text)returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.finance_calls;
begin
 if p_state is not null then
  if p_seq=-1 then insert into public.finance_calls(id,state,response)values(p_id,p_state,p_response)on conflict do nothing;
  else update public.finance_calls set state=p_state,response=p_response,seq=seq+1,updated_at=now()where id=p_id and seq=p_seq;end if;
 end if;
 select * into r from public.finance_calls where id=p_id;return to_jsonb(r);
end $$;
revoke all on function public.finance_call(text,integer,jsonb,text)from public,anon,authenticated;
grant execute on function public.finance_call(text,integer,jsonb,text)to service_role;
