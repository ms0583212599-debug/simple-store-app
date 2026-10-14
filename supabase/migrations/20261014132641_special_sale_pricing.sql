-- Additive support for grouped manual sales; existing clients keep their RPC.
alter table public.manual_product_sales add column if not exists sale_group uuid;
alter table public.manual_product_sales add column if not exists line_index integer;
alter table public.manual_product_sales add column if not exists request_signature text;
alter table public.manual_product_sales add column if not exists pricing_mode text;
alter table public.manual_product_sales add column if not exists discount_kind text;
alter table public.manual_product_sales add column if not exists discount_value numeric;
create unique index if not exists manual_sale_group_line on public.manual_product_sales(sale_group,line_index);

-- Same calculation for website/tablet, preview and save. No card charge is made.
create or replace function public.price_manual_sale(
 p_items jsonb, p_mode text, p_discount_kind text default 'percent',
 p_discount_value numeric default 0, p_note text default null,
 p_request_id uuid default null, p_commit boolean default false,
 p_expected_total numeric default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 item jsonb; prod public.products%rowtype; lines jsonb := '[]';
 q integer; base numeric; unit_price numeric; amount numeric; subtotal numeric:=0;
 reduction numeric:=0; remaining numeric; allocated numeric:=0; line_discount numeric;
 kind text; val numeric; idx integer:=0; signature text; result jsonb;
begin
 if auth.uid() is null or not coalesce(private.is_store_admin(),false) then raise exception 'not authorized'; end if;
 if p_mode is null or p_mode not in ('regular','cost','item_discount','sale_discount') then raise exception 'invalid pricing mode'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'יש לבחור בין מוצר אחד ל-100 מוצרים'; end if;
 if p_commit is null then raise exception 'invalid commit'; end if;
 signature:=md5(jsonb_build_object('items',p_items,'mode',p_mode,'kind',p_discount_kind,'value',p_discount_value,'note',p_note)::text);
 if p_commit and p_request_id is null then raise exception 'request id required'; end if;
 if p_request_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  if exists(select 1 from public.manual_product_sales where sale_group=p_request_id) then
   if exists(select 1 from public.manual_product_sales where sale_group=p_request_id and (created_by is distinct from auth.uid() or request_signature is distinct from signature)) then raise exception 'request id conflict'; end if;
   select jsonb_build_object('saved',true,'sale_group',p_request_id,'total',sum(line_amount)) into result from public.manual_product_sales where sale_group=p_request_id;
   return result;
  end if;
 end if;
 if (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then raise exception 'יש לאחד שורות של אותו מוצר'; end if;
 -- Lock in stable order, then compute from current server prices.
 perform 1 from public.products where id in (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x) order by id for update;
 for item in select value from jsonb_array_elements(p_items) loop
  if coalesce(item->>'quantity','') !~ '^[1-9][0-9]{0,5}$' then raise exception 'כמות לא תקינה'; end if;
  q:=(item->>'quantity')::integer;
  select * into prod from public.products where id=(item->>'product_id')::uuid;
  if not found or prod.is_active=false then raise exception 'המוצר לא זמין'; end if;
  if coalesce(prod.stock_quantity,0)<q then raise exception 'אין מספיק מלאי עבור %',prod.name; end if;
  base:=round(coalesce(prod.price,0),2);
  unit_price:=case when p_mode='cost' then round(case when coalesce(prod.average_cost,0)>0 then prod.average_cost else coalesce(prod.last_purchase_price,0) end,2) else base end;
  kind:=null;val:=0;
  if p_mode='item_discount' then
   kind:=item->>'discount_kind';val:=(item->>'discount_value')::numeric;
   if kind is null or kind not in ('percent','amount') or val is null or val::text in ('NaN','Infinity','-Infinity') or val<0 or (kind='percent' and val>100) or (kind='amount' and val>base) then raise exception 'הנחת מוצר לא תקינה'; end if;
   unit_price:=round(base-case when kind='percent' then base*val/100 else val end,2);
  end if;
  if unit_price<0 then raise exception 'מחיר לא תקין'; end if;
  amount:=unit_price*q;subtotal:=subtotal+amount;
  lines:=lines||jsonb_build_array(jsonb_build_object('product_id',prod.id,'name',prod.name,'quantity',q,'unit_price',unit_price,'line_amount',amount,'discount_kind',kind,'discount_value',val,'unit_cost',case when coalesce(prod.average_cost,0)>0 then prod.average_cost else coalesce(prod.last_purchase_price,0) end));
 end loop;
 if p_mode='sale_discount' then
  if p_discount_kind is null or p_discount_kind not in ('percent','amount') or p_discount_value is null or p_discount_value::text in ('NaN','Infinity','-Infinity') or p_discount_value<0 or (p_discount_kind='percent' and p_discount_value>100) or (p_discount_kind='amount' and p_discount_value>subtotal) then raise exception 'הנחה לכל המכירה לא תקינה'; end if;
  reduction:=round(case when p_discount_kind='percent' then subtotal*p_discount_value/100 else p_discount_value end,2);
 end if;
 remaining:=reduction;
 for idx in 0..jsonb_array_length(lines)-1 loop
  item:=lines->idx;amount:=(item->>'line_amount')::numeric;
  -- Cumulative rounding keeps allocations exact, including a one-agora discount.
  allocated:=allocated+amount;
  line_discount:=case when subtotal=0 then 0 else reduction-remaining end;
  line_discount:=case when subtotal=0 then 0 else round(reduction*allocated/subtotal,2)-line_discount end;
  remaining:=remaining-line_discount;amount:=amount-line_discount;
  lines:=jsonb_set(lines,array[idx::text,'line_amount'],to_jsonb(amount));
  lines:=jsonb_set(lines,array[idx::text,'unit_price'],to_jsonb(amount/(item->>'quantity')::integer));
 end loop;
 result:=jsonb_build_object('saved',false,'subtotal',subtotal,'discount',reduction,'total',subtotal-reduction,'lines',lines);
 if not p_commit then return result; end if;
 if p_expected_total is null or p_expected_total is distinct from subtotal-reduction then raise exception 'המחירים השתנו. יש לבדוק ולאשר מחדש את הסכום'; end if;
 idx:=0;
 for item in select value from jsonb_array_elements(lines) loop
  update public.products set stock_quantity=stock_quantity-(item->>'quantity')::integer where id=(item->>'product_id')::uuid;
  insert into public.manual_product_sales(product_id,product_name,quantity,sale_type,unit_sale_price,unit_cost,line_amount,note,created_by,sale_group,line_index,request_signature,pricing_mode,discount_kind,discount_value)
  values((item->>'product_id')::uuid,item->>'name',(item->>'quantity')::integer,case when p_mode='cost' then 'cost' else 'discount' end,(item->>'unit_price')::numeric,(item->>'unit_cost')::numeric,(item->>'line_amount')::numeric,p_note,auth.uid(),p_request_id,idx,signature,p_mode,case when p_mode='sale_discount' then p_discount_kind else item->>'discount_kind' end,case when p_mode='sale_discount' then p_discount_value else (item->>'discount_value')::numeric end);
  insert into public.inventory_movements(product_id,change_qty,reason,note,created_by) values((item->>'product_id')::uuid,-(item->>'quantity')::integer,'מכירה מיוחדת',concat_ws(' — ',case p_mode when 'regular' then 'מחיר רגיל' when 'cost' then 'מחיר עלות' when 'item_discount' then 'הנחה לכל מוצר' else 'הנחה לכל המכירה' end,nullif(p_note,'')),auth.uid());
  idx:=idx+1;
 end loop;
 return result||jsonb_build_object('saved',true,'sale_group',p_request_id);
end $$;
revoke all on function public.price_manual_sale(jsonb,text,text,numeric,text,uuid,boolean,numeric) from public,anon;
grant execute on function public.price_manual_sale(jsonb,text,text,numeric,text,uuid,boolean,numeric) to authenticated;
