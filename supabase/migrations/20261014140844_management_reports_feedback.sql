alter table public.sales add column if not exists card_last4 text check(card_last4 is null or card_last4 ~ '^[0-9]{4}$');
-- A read-only unified source avoids copying or double-posting historical revenue.
create or replace view private.management_sale_rows as
select s.id,'sale'::text as source_type,coalesce(s.paid_at,s.created_at) as created_at,s.total_amount,s.payment_method,s.payment_reference,s.card_last4,
 coalesce((select jsonb_agg(jsonb_build_object('product_id',i.product_id,'product_name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total)) from public.sale_items i where i.sale_id=s.id),'[]'::jsonb) as items
from public.sales s where s.status='paid'
union all
select coalesce(m.sale_group,m.id),'special_sale',min(m.sold_at),sum(m.line_amount),'מכירה מיוחדת',null,null,
 jsonb_agg(jsonb_build_object('product_id',m.product_id,'product_name',m.product_name,'quantity',m.quantity,'unit_price',m.unit_sale_price,'line_total',m.line_amount))
from public.manual_product_sales m group by coalesce(m.sale_group,m.id);
revoke all on private.management_sale_rows from public,anon,authenticated;

create or replace function public.search_store_sales(p_from date default null,p_to date default null,p_last4 text default '',p_product text default '',p_min numeric default null,p_max numeric default null,p_reference text default '',p_method text default '',p_page integer default 0,p_sort integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(private.is_store_admin(),false) then raise exception 'not authorized';end if;
 if coalesce(p_last4,'')<>'' and p_last4 !~ '^[0-9]{4}$' then raise exception 'יש להזין ארבע ספרות';end if;
 if p_from>p_to or p_min<0 or p_max<0 or p_min>p_max or p_page<0 then raise exception 'טווח חיפוש לא תקין';end if;
 with filtered as (
 select * from private.management_sale_rows s where
 (p_from is null or (s.created_at at time zone 'Asia/Jerusalem')::date>=p_from) and
 (p_to is null or (s.created_at at time zone 'Asia/Jerusalem')::date<=p_to) and
 (coalesce(p_last4,'')='' or s.card_last4=p_last4) and
 (coalesce(p_product,'')='' or exists(select 1 from jsonb_array_elements(s.items) i where strpos(lower(i->>'product_name'),lower(p_product))>0)) and
 (p_min is null or s.total_amount>=p_min) and (p_max is null or s.total_amount<=p_max) and
 (coalesce(p_reference,'')='' or strpos(lower(s.id::text||' '||coalesce(s.payment_reference,'')),lower(p_reference))>0) and
 (coalesce(p_method,'')='' or strpos(lower(coalesce(s.payment_method,'')),lower(p_method))>0)),
 paged as (select * from filtered order by case when p_sort=1 then created_at end asc,case when p_sort=2 then total_amount end desc,case when p_sort=3 then total_amount end asc,created_at desc,id limit 50 offset greatest(coalesce(p_page,0),0)*50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),'count',(select count(*) from filtered),'total',(select coalesce(sum(total_amount),0) from filtered),'units',(select coalesce(sum((i->>'quantity')::numeric),0) from filtered f cross join lateral jsonb_array_elements(f.items) i)) into result;
 return result;
end $$;
revoke all on function public.search_store_sales(date,date,text,text,numeric,numeric,text,text,integer,integer) from public,anon;
grant execute on function public.search_store_sales(date,date,text,text,numeric,numeric,text,text,integer,integer) to authenticated;

create or replace function public.get_store_sales_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; d date:=(now() at time zone 'Asia/Jerusalem')::date;
begin
 if not coalesce(private.is_store_admin(),false) then raise exception 'not authorized';end if;
 select jsonb_build_object('today',coalesce(sum(total_amount) filter(where (created_at at time zone 'Asia/Jerusalem')::date=d),0),'month',coalesce(sum(total_amount) filter(where (created_at at time zone 'Asia/Jerusalem')::date>=date_trunc('month',d)::date),0),'all',coalesce(sum(total_amount),0),'today_count',count(*) filter(where (created_at at time zone 'Asia/Jerusalem')::date=d)) into result from private.management_sale_rows;
 return result;
end $$;
revoke all on function public.get_store_sales_summary() from public,anon;
grant execute on function public.get_store_sales_summary() to authenticated;

create or replace function public.get_store_finance(p_from date default null,p_to date default null,p_page integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not coalesce(private.is_store_admin(),false) then raise exception 'not authorized';end if;
 if p_from>p_to or p_page<0 then raise exception 'טווח לא תקין';end if;
 with entries as (
 select f.id,f.entry_type,f.amount,f.payment_method,f.entry_date,f.description,f.source_type,f.source_id,f.created_at,false as automatic from public.finance_entries f
 where not coalesce((f.source_type in ('sale','special_sale') and exists(select 1 from private.management_sale_rows s where s.id=f.source_id and s.source_type=f.source_type)),false)
 union all
 select s.id,'income',s.total_amount,s.payment_method,(s.created_at at time zone 'Asia/Jerusalem')::date,case when s.source_type='special_sale' then 'מכירה מיוחדת' else 'עסקה ששולמה' end,s.source_type,s.id,s.created_at,true from private.management_sale_rows s
 ),filtered as(select * from entries where (p_from is null or entry_date>=p_from) and (p_to is null or entry_date<=p_to)),paged as(select * from filtered order by entry_date desc,created_at desc,id limit 100 offset greatest(coalesce(p_page,0),0)*100)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),'count',(select count(*) from filtered),'income',(select coalesce(sum(amount),0) from filtered where entry_type='income'),'expense',(select coalesce(sum(amount),0) from filtered where entry_type='expense')) into result;
 return result;
end $$;
revoke all on function public.get_store_finance(date,date,integer) from public,anon;
grant execute on function public.get_store_finance(date,date,integer) to authenticated;

create or replace function public.get_feedback_email_setting() returns text language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(private.is_store_admin(),false) then raise exception 'not authorized';end if;
 return (select coalesce(feedback_email,'') from public.storefront_design_settings where id=1);
end $$;
create or replace function public.set_feedback_email_setting(p_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(private.is_store_admin(),false) then raise exception 'not authorized';end if;
 if p_email is null or length(p_email)>254 or (trim(p_email)<>'' and trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'כתובת מייל לא תקינה';end if;
 update public.storefront_design_settings set feedback_email=nullif(trim(p_email),''),updated_at=now() where id=1;
end $$;
revoke all on function public.get_feedback_email_setting() from public,anon;
revoke all on function public.set_feedback_email_setting(text) from public,anon;
grant execute on function public.get_feedback_email_setting(), public.set_feedback_email_setting(text) to authenticated;

-- Dispatch state is server-only; customer message text remains in the existing table.
create table if not exists public.feedback_email_dispatch(feedback_id uuid primary key references public.customer_feedback(id) on delete cascade,state text not null default 'pending',claimed_at timestamptz,sent_at timestamptz,attempts integer not null default 0);
alter table public.feedback_email_dispatch enable row level security;
revoke all on public.feedback_email_dispatch from public,anon,authenticated;
grant all on public.feedback_email_dispatch to service_role;
create or replace function public.claim_feedback_email(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 insert into public.feedback_email_dispatch(feedback_id) values(p_id) on conflict do nothing;
 update public.feedback_email_dispatch set state='sending',claimed_at=now(),attempts=attempts+1 where feedback_id=p_id and state<>'sent' and (claimed_at is null or claimed_at<now()-interval '2 minutes') and attempts<5;
 return found;
end $$;
revoke all on function public.claim_feedback_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_feedback_email(uuid) to service_role;
