create function public.finance_dashboard_read(p_from date,p_to date,p_kind text,p_type text,p_category bigint,p_page integer)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as materialized (
 select t.id,t.kind,t.flow_type,t.amount_agorot,t.occurred_on,t.note,t.created_at,c.name as category_name
 from public.finance_transactions t join public.finance_categories c on c.id=t.category_id
 where t.voided_at is null and t.occurred_on between p_from and p_to
 and (p_kind is null or t.kind=p_kind)
 and (p_type is null or t.flow_type=p_type or (p_type='unclassified' and t.flow_type is null))
 and (p_category is null or t.category_id=p_category)
), groups as (
 select flow_type,coalesce(sum(amount_agorot) filter(where kind='income'),0) as income,
 coalesce(sum(amount_agorot) filter(where kind='expense'),0) as expense from filtered group by flow_type
), page_rows as (select * from filtered order by occurred_on desc,created_at desc,id desc limit 50 offset greatest(0,least(p_page,100000))*50)
select jsonb_build_object(
 'total',(select count(*) from filtered),
 'income',coalesce((select sum(amount_agorot) from filtered where kind='income'),0),
 'expense',coalesce((select sum(amount_agorot) from filtered where kind='expense'),0),
 'groups',coalesce((select jsonb_agg(g) from groups g),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(r) from page_rows r),'[]'::jsonb),
 'categories',(select coalesce(jsonb_agg(c order by c.kind,c.dial_code),'[]'::jsonb) from (select id,kind,name,dial_code from public.finance_categories)c)
);
$$;
revoke all on function public.finance_dashboard_read(date,date,text,text,bigint,integer) from public,anon,authenticated;
grant execute on function public.finance_dashboard_read(date,date,text,text,bigint,integer) to service_role;
