-- Synthetic fixtures only, all writes are rolled back.
begin;
do $$
declare admin_id uuid; cat uuid; a uuid; b uuid; req uuid:=gen_random_uuid(); items jsonb; r jsonb; n integer; blocked boolean;
begin
 select user_id into admin_id from public.store_admins limit 1;
 if admin_id is null then raise exception 'admin fixture unavailable'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.categories(name) values('TEST rollback-only pricing') returning id into cat;
 insert into public.products(category_id,name,price,stock_quantity,average_cost,last_purchase_price) values(cat,'TEST A',10,10,6,5) returning id into a;
 insert into public.products(category_id,name,price,stock_quantity,average_cost,last_purchase_price) values(cat,'TEST B',5,10,0,3) returning id into b;
 items:=jsonb_build_array(jsonb_build_object('product_id',a,'quantity',2),jsonb_build_object('product_id',b,'quantity',1));
 r:=public.price_manual_sale(items,'regular');if (r->>'total')::numeric<>25 then raise exception 'regular failed';end if;
 r:=public.price_manual_sale(items,'cost');if (r->>'total')::numeric<>15 then raise exception 'cost fallback failed';end if;
 r:=public.price_manual_sale(jsonb_build_array(jsonb_build_object('product_id',a,'quantity',2,'discount_kind','percent','discount_value',10),jsonb_build_object('product_id',b,'quantity',1,'discount_kind','amount','discount_value',2)),'item_discount');if (r->>'total')::numeric<>21 then raise exception 'item discounts failed';end if;
 r:=public.price_manual_sale(items,'sale_discount','percent',10);if (r->>'total')::numeric<>22.5 then raise exception 'sale percent failed';end if;
 r:=public.price_manual_sale(items,'sale_discount','amount',0.01);if (r->>'total')::numeric<>24.99 or (select sum((x->>'line_amount')::numeric) from jsonb_array_elements(r->'lines') x)<>24.99 then raise exception 'agora allocation failed';end if;
 r:=public.price_manual_sale(items,'sale_discount','percent',100);if (r->>'total')::numeric<>0 then raise exception 'free sale failed';end if;
 blocked:=false;begin perform public.price_manual_sale(items,'sale_discount','percent',101);exception when others then blocked:=true;end;if not blocked then raise exception 'over 100 accepted';end if;
 blocked:=false;begin perform public.price_manual_sale(items,'sale_discount','amount',26);exception when others then blocked:=true;end;if not blocked then raise exception 'excess amount accepted';end if;
 blocked:=false;begin perform public.price_manual_sale(items,'regular','percent',0,null,req,true,24);exception when others then blocked:=true;end;if not blocked then raise exception 'stale total accepted';end if;
 select stock_quantity into n from public.products where id=a;if n<>10 then raise exception 'preview changed stock';end if;
 r:=public.price_manual_sale(items,'sale_discount','amount',0.01,'fixture',req,true,24.99);
 if not (r->>'saved')::boolean then raise exception 'save failed';end if;
 select stock_quantity into n from public.products where id=a;if n<>8 then raise exception 'stock wrong';end if;
 r:=public.price_manual_sale(items,'sale_discount','amount',0.01,'fixture',req,true,24.99);
 r:=public.price_manual_sale(items,'sale_discount','amount',0.01,'fixture',req,false);
 select stock_quantity into n from public.products where id=a;if n<>8 then raise exception 'retry deducted stock twice';end if;
 if not (r->>'saved')::boolean then raise exception 'lost response retry preview failed';end if;
 if (select count(*) from public.manual_product_sales where sale_group=req)<>2 then raise exception 'group duplicate';end if;
 if (select sales_amount from public.get_product_activity_summary(null,null) where product_id=a)<>19.99 then raise exception 'report amount wrong';end if;
 blocked:=false;begin perform public.price_manual_sale(jsonb_build_array(jsonb_build_object('product_id',a,'quantity',1),jsonb_build_object('product_id',b,'quantity',100)),'regular','percent',0,null,gen_random_uuid(),true,510);exception when others then blocked:=true;end;if not blocked then raise exception 'insufficient stock accepted';end if;
 select stock_quantity into n from public.products where id=a;if n<>8 then raise exception 'partial stock deduction';end if;
 perform set_config('request.jwt.claim.sub','',true);
 blocked:=false;begin perform public.price_manual_sale(items,'regular');exception when others then blocked:=true;end;if not blocked then raise exception 'anonymous accepted';end if;
 if has_function_privilege('anon','public.price_manual_sale(jsonb,text,text,numeric,text,uuid,boolean,numeric)','execute') then raise exception 'anonymous execute grant';end if;
end $$;
rollback;
select 'PASS: regular/cost/per-item/whole-sale, exact cents, invalid discounts, atomic stock, idempotent retry, reports and authorization; all fixtures rolled back' as result;
