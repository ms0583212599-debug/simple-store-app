begin;
do $$
declare admin_id uuid; cat uuid; product uuid; sale uuid; item uuid; unknown_sale uuid; pending uuid; result jsonb; summary jsonb; blocked boolean;
begin
 select user_id into admin_id from public.store_admins limit 1;perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.categories(name) values('TEST finance rollback') returning id into cat;
 insert into public.products(category_id,name,price,stock_quantity,average_cost,last_purchase_price) values(cat,'TEST finance item',10,10,6,5) returning id into product;
 insert into public.sales(total_amount,status,paid_at,payment_method,nedarim_verified) values(20,'paid','2041-02-02 12:00Z','אשראי',true) returning id into sale;
 insert into public.sale_items(sale_id,product_id,product_name,unit_price,quantity) values(sale,product,'TEST finance item',10,2) returning id into item;
 if (select unit_cost from private.sale_cost_snapshots where item_id=item)<>6 then raise exception 'snapshot not captured';end if;
 update public.products set average_cost=8 where id=product;
 if (select unit_cost from private.sale_cost_snapshots where item_id=item)<>6 then raise exception 'historical snapshot changed';end if;
 insert into public.finance_entries(entry_type,amount,entry_date,source_type,description) values('income',4,'2041-02-02','manual','TEST other income'),('expense',100,'2041-02-02','purchase','TEST stock purchase'),('expense',3,'2041-02-02','manual','TEST utility');
 result:=public.get_financial_summary('2041-02-02','2041-02-02','balance');summary:=result->'summary';
 if (summary->>'sales')::numeric<>20 or (summary->>'known_cost')::numeric<>12 or (summary->>'gross_profit')::numeric<>8 or (summary->>'net_profit')::numeric<>5 or (summary->>'balance')::numeric<>-79 or (result->>'count')::int<>4 then raise exception 'cash/profit calculation mismatch';end if;
 result:=public.get_financial_summary('2041-02-02','2041-02-02','sales');if (result->>'count')::int<>1 or result->'rows'->0->'items'->0->>'product_name'<>'TEST finance item' then raise exception 'sales drilldown';end if;
 result:=public.get_financial_summary('2041-02-02','2041-02-02','purchases');if (result->>'count')::int<>1 then raise exception 'purchase drilldown';end if;
 result:=public.get_financial_summary('2041-02-02','2041-02-02','expenses');if (result->>'count')::int<>1 then raise exception 'expense drilldown';end if;
 insert into public.sales(total_amount,status,paid_at,payment_method) values(7,'paid','2041-02-02 12:00Z','מזומן') returning id into unknown_sale;
 insert into public.sale_items(sale_id,product_name,unit_price,quantity) values(unknown_sale,'TEST unknown product',7,1);
 insert into public.sales(total_amount,status,created_at) values(999,'pending','2041-02-02 12:00Z') returning id into pending;
 result:=public.get_financial_summary('2041-02-02','2041-02-02','missing');summary:=result->'summary';
 if (summary->>'sales')::numeric<>27 or (summary->>'missing_count')::int<>1 or summary->>'net_profit' is not null or summary->>'gross_profit' is not null or (result->>'count')::int<>1 then raise exception 'missing cost or pending handling';end if;
 result:=public.get_financial_summary('2041-02-03','2041-02-03','sales');if (result->>'count')::int<>0 or (result->'summary'->>'balance')::numeric<>0 then raise exception 'empty period';end if;
 perform set_config('request.jwt.claim.sub','',true);blocked:=false;begin perform public.get_financial_summary();exception when others then blocked:=true;end;if not blocked then raise exception 'unauthorized report';end if;
 if has_table_privilege('authenticated','private.sale_cost_snapshots','select') or has_table_privilege('anon','private.sale_cost_snapshots','select') or has_function_privilege('anon','public.get_financial_summary(date,date,text,integer)','execute') then raise exception 'private financial data exposed';end if;
end $$;
rollback;
select 'PASS: frozen cost snapshots, recorded cash versus profit, expense and stock separation, period drilldown, missing-cost suppression, pending exclusion and authorization; synthetic fixtures rolled back' result;
