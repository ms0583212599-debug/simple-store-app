begin;
do $$
declare cat uuid; p uuid; r record; sid uuid; n integer; blocked boolean; before_count bigint;
begin
 insert into public.categories(name) values('TEST quantity rollback') returning id into cat;
 insert into public.products(category_id,name,price,stock_quantity,average_cost,promotion_enabled,promotion_quantity,promotion_price) values(cat,'TEST bundle',10,100,6,true,2,18) returning id into p;
 for n in 1..5 loop
  select * into r from public.create_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',n,'unit_price',0.01)));
  if r.total_amount<>(n/2)*18+(n%2)*10 then raise exception 'bundle or client price trust';end if;
  if (select sum(line_total) from public.sale_items where sale_id=r.sale_id)<>r.total_amount or (select sum(quantity) from public.sale_items where sale_id=r.sale_id)<>n then raise exception 'line totals mismatch';end if;
 end loop;
 select * into r from public.create_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1),jsonb_build_object('product_id',p,'quantity',1)));if r.total_amount<>18 then raise exception 'duplicate ids not grouped';end if;
 update public.products set promotion_quantity=3,promotion_price=25 where id=p;
 select * into r from public.create_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',7)));if r.total_amount<>60 or (select sum(line_total) from public.sale_items where sale_id=r.sale_id)<>60 or (select sum(quantity) from public.sale_items where sale_id=r.sale_id)<>7 then raise exception 'exact cents allocation';end if;
 if (select count(*) from private.sale_cost_snapshots c join public.sale_items i on c.item_id=i.id where i.sale_id=r.sale_id and c.unit_cost=6)<>(select count(*) from public.sale_items where sale_id=r.sale_id) then raise exception 'cost snapshots not captured';end if;
 perform public.finalize_paid_sale(r.sale_id,'TEST bundle fixture');if (select stock_quantity from public.products where id=p)<>93 then raise exception 'inventory quantity wrong';end if;
 perform public.finalize_paid_sale(r.sale_id,'TEST bundle fixture');if (select stock_quantity from public.products where id=p)<>93 then raise exception 'duplicate inventory change';end if;
 update public.products set promotion_enabled=false where id=p;
 select * into r from public.create_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',3)));if r.total_amount<>30 then raise exception 'disabled promotion applied';end if;
 select * into r from public.create_sale('[{"quantity":1,"unit_price":12.34}]'::jsonb);if r.total_amount<>12.34 then raise exception 'general amount broken';end if;
 blocked:=false;begin update public.products set promotion_enabled=true,promotion_quantity=1 where id=p;exception when others then blocked:=true;end;if not blocked then raise exception 'invalid promotion accepted';end if;
 select count(*) into before_count from public.sales;
 blocked:=false;begin perform public.create_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',50),jsonb_build_object('product_id',p,'quantity',50)));exception when others then blocked:=true;end;if not blocked then raise exception 'duplicate stock bypass';end if;
 if (select count(*) from public.sales)<>before_count then raise exception 'failed checkout left sale';end if;
 blocked:=false;begin perform public.create_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1.5)));exception when others then blocked:=true;end;if not blocked then raise exception 'fractional units accepted';end if;
end $$;
rollback;
select 'PASS: regular/bundles/remainder/repeated bundles, duplicate product grouping, exact cents, server-authoritative prices, cost snapshots, inventory finalization, disabled/invalid promotions, general amount, stock and atomic rollback; no retained test sales' result;
