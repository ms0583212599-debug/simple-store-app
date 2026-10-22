create or replace function finance_private.finance_read(p_data jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
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
 rows as(select * from filtered where coalesce((p_data->>'include_voided')::boolean,false)or voided_at is null order by occurred_on desc,id desc limit case when mode='export' then 5001 else 50 end offset case when mode='export' then 0 else greatest(0,least(coalesce((p_data->>'page')::int,0),100000))*50 end)
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
