-- Cost snapshots are private; existing transactions are intentionally not backfilled.
create table private.sale_cost_snapshots(item_id uuid primary key references public.sale_items(id) on delete cascade,unit_cost numeric check(unit_cost>=0),recorded_at timestamptz not null default now());
alter table private.sale_cost_snapshots enable row level security;
revoke all on private.sale_cost_snapshots from public,anon,authenticated;
create function private.capture_sale_cost() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.sale_cost_snapshots(item_id,unit_cost)
 select new.id,coalesce(nullif(greatest(p.average_cost,0),0),nullif(greatest(p.last_purchase_price,0),0)) from public.products p where p.id=new.product_id;
 return new;
end $$;
revoke all on function private.capture_sale_cost() from public,anon,authenticated;
create trigger capture_sale_cost after insert on public.sale_items for each row execute function private.capture_sale_cost();

create view private.financial_sale_costs as
select s.id,'sale'::text source_type,coalesce(sum(i.quantity*c.unit_cost),0) known_cost,
 (count(i.id)=0 or count(*) filter(where c.unit_cost is null)>0) missing_cost,
 coalesce(jsonb_agg(jsonb_build_object('product_name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total,'unit_cost',c.unit_cost)) filter(where i.id is not null),'[]'::jsonb) items
from public.sales s left join public.sale_items i on i.sale_id=s.id left join private.sale_cost_snapshots c on c.item_id=i.id where s.status='paid' group by s.id
union all
select coalesce(sale_group,id),'special_sale',sum(quantity*unit_cost),bool_or(unit_cost<=0),jsonb_agg(jsonb_build_object('product_name',product_name,'quantity',quantity,'unit_price',unit_sale_price,'line_total',line_amount,'unit_cost',nullif(unit_cost,0))) from public.manual_product_sales group by coalesce(sale_group,id);
revoke all on private.financial_sale_costs from public,anon,authenticated;
create view private.financial_summary_rows as
select s.id,s.source_type,(s.created_at at time zone 'Asia/Jerusalem')::date entry_date,s.created_at,'income'::text entry_type,s.total_amount amount,
 case when s.source_type='special_sale' then 'מכירה מיוחדת — אמצעי תשלום לא תועד' else coalesce(s.payment_method,'לא תועד') end payment_method,
 case when s.source_type='special_sale' then 'מכירה מיוחדת' else 'עסקה ששולמה' end description,
 'sales'::text bucket,c.known_cost,c.missing_cost,c.items,s.card_last4,s.payment_reference,
 case when s.source_type='sale' then coalesce((select nedarim_verified from public.sales where id=s.id),false) else null end verified
from private.management_sale_rows s join private.financial_sale_costs c on c.id=s.id and c.source_type=s.source_type
union all
select f.id,coalesce(f.source_type,'manual'),f.entry_date,f.created_at,f.entry_type,f.amount,coalesce(f.payment_method,'לא תועד'),coalesce(f.description,''),
 case when f.entry_type='income' then 'other_income' when f.source_type='purchase' then 'purchases' else 'expenses' end,
 0,false,'[]'::jsonb,null,null,null
from public.finance_entries f where not coalesce((f.source_type in ('sale','special_sale') and exists(select 1 from private.management_sale_rows s where s.id=f.source_id and s.source_type=f.source_type)),false);
revoke all on private.financial_summary_rows from public,anon,authenticated;
create function public.get_financial_summary(p_from date default null,p_to date default null,p_bucket text default 'sales',p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(private.is_store_admin(),false) then raise exception 'not authorized';end if;
 if p_from>p_to or p_page<0 or p_bucket not in ('sales','other_income','purchases','expenses','balance','cost','missing','profit') then raise exception 'invalid filters';end if;
 with filtered as materialized(select * from private.financial_summary_rows where (p_from is null or entry_date>=p_from) and (p_to is null or entry_date<=p_to)),
 totals as (select coalesce(sum(amount) filter(where bucket='sales'),0) sales,coalesce(sum(amount) filter(where bucket='other_income'),0) other_income,coalesce(sum(amount) filter(where bucket='purchases'),0) purchases,coalesce(sum(amount) filter(where bucket='expenses'),0) expenses,coalesce(sum(known_cost) filter(where bucket='sales'),0) known_cost,count(*) filter(where bucket='sales' and missing_cost) missing_count,count(*) filter(where bucket='sales') sale_count,count(*) filter(where bucket='sales' and verified=true) verified_count from filtered),
 details as(select * from filtered where case p_bucket when 'balance' then true when 'profit' then bucket in ('sales','expenses') when 'cost' then bucket='sales' when 'missing' then bucket='sales' and missing_cost else bucket=p_bucket end),
 paged as(select * from details order by entry_date desc,created_at desc,id limit 50 offset p_page*50)
 select jsonb_build_object('summary',(select to_jsonb(t)||jsonb_build_object('balance',sales+other_income-purchases-expenses,'gross_profit',case when missing_count=0 then sales-known_cost else null end,'net_profit',case when missing_count=0 then sales-known_cost-expenses else null end) from totals t),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),'count',(select count(*) from details),'methods',coalesce((select jsonb_agg(to_jsonb(m)) from (select payment_method,sum(amount) amount,count(*) count from filtered where bucket='sales' group by payment_method order by sum(amount) desc) m),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_financial_summary(date,date,text,integer) from public,anon;
grant execute on function public.get_financial_summary(date,date,text,integer) to authenticated;
