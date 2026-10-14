alter table public.products add column promotion_enabled boolean not null default false,add column promotion_quantity integer,add column promotion_price numeric(12,2);
alter table public.products add constraint valid_quantity_promotion check(not promotion_enabled or (promotion_quantity is not null and promotion_quantity between 2 and 9999 and promotion_price is not null and promotion_price>0 and promotion_price<price*promotion_quantity));
create or replace function public.create_sale(p_items jsonb) returns table(sale_id uuid,external_token text,total_amount numeric) language plpgsql security definer set search_path='' as $$
declare sid uuid; token text; total numeric:=0; item jsonb; r record; product public.products%rowtype; qty integer; groups integer; remainder integer; cents bigint; low_cents bigint; high_count integer; grouped_qty integer; unit numeric; line_qty integer;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>500 then raise exception 'Cart is empty or too large';end if;
 for item in select * from jsonb_array_elements(p_items) loop
  if coalesce(item->>'quantity','') !~ '^[0-9]+$' or (item->>'quantity')::numeric not between 1 and 99999 then raise exception 'Invalid quantity';end if;
 end loop;
 token:=replace(gen_random_uuid()::text,'-','');insert into public.sales(total_amount,status,external_token) values(0,'pending',token) returning id into sid;
 -- Combine repeated product IDs before applying bundles or checking stock.
 for r in select nullif(x->>'product_id','')::uuid id,sum((x->>'quantity')::int)::int quantity from jsonb_array_elements(p_items) x where nullif(x->>'product_id','') is not null group by 1 order by 1 loop
  qty:=r.quantity;if qty>99999 then raise exception 'Invalid quantity';end if;
  select * into product from public.products where id=r.id for update;
  if not found or product.is_active=false or product.stock_quantity<qty then raise exception 'Insufficient stock';end if;
  if product.promotion_enabled then
   groups:=qty/product.promotion_quantity;remainder:=qty%product.promotion_quantity;cents:=round(product.promotion_price*100)::bigint;low_cents:=cents/product.promotion_quantity;high_count:=(cents%product.promotion_quantity)::int;
   grouped_qty:=groups*(product.promotion_quantity-high_count);
   if grouped_qty>0 then insert into public.sale_items(sale_id,product_id,product_name,unit_price,quantity) values(sid,product.id,product.name,low_cents/100.0,grouped_qty);end if;
   grouped_qty:=groups*high_count;
   if grouped_qty>0 then insert into public.sale_items(sale_id,product_id,product_name,unit_price,quantity) values(sid,product.id,product.name,(low_cents+1)/100.0,grouped_qty);end if;
   total:=total+groups*product.promotion_price+remainder*product.price;
  else remainder:=qty;total:=total+qty*product.price;end if;
  if remainder>0 then insert into public.sale_items(sale_id,product_id,product_name,unit_price,quantity) values(sid,product.id,product.name,product.price,remainder);end if;
 end loop;
 for item in select * from jsonb_array_elements(p_items) x where nullif(x->>'product_id','') is null loop
  qty:=(item->>'quantity')::integer;unit:=round((item->>'unit_price')::numeric,2);
  if unit is null or unit<=0 or unit='NaN'::numeric or unit>1000000 then raise exception 'Invalid amount';end if;
  total:=total+unit*qty;insert into public.sale_items(sale_id,product_id,product_name,unit_price,quantity) values(sid,null,'סכום מהמחשבון',unit,qty);
 end loop;
 if total<=0 then raise exception 'Invalid total';end if;
 update public.sales set total_amount=total where id=sid;
 return query select sid,token,total;
end $$;
