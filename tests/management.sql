-- No real transactions, messages or settings are retained.
begin;
do $$
declare a uuid; s uuid; pending uuid; cat uuid; p uuid; g uuid:=gen_random_uuid(); f uuid; r jsonb; baseline numeric; blocked boolean;
begin
select user_id into a from public.store_admins limit 1;perform set_config('request.jwt.claim.sub',a::text,true);
baseline:=(public.get_store_finance()->>'income')::numeric;
insert into public.categories(name) values('TEST management rollback') returning id into cat;
insert into public.products(category_id,name,price,stock_quantity) values(cat,'TEST management product',10,10) returning id into p;
insert into public.sales(total_amount,status,payment_method,payment_reference,card_last4,created_at,paid_at) values(20,'paid','אשראי','TEST management receipt','0123','2040-01-01 22:30Z','2040-01-01 22:30Z') returning id into s;
insert into public.sale_items(sale_id,product_id,product_name,quantity,unit_price) values(s,p,'TEST management product',2,10);
insert into public.sales(total_amount,status,payment_method) values(999,'pending','אשראי') returning id into pending;
perform public.price_manual_sale(jsonb_build_array(jsonb_build_object('product_id',p,'quantity',1)),'regular','percent',0,'TEST',g,true,10);
r:=public.search_store_sales('2040-01-02','2040-01-02','0123','management',20,20,'TEST management receipt','אשראי');
if (r->>'count')::int<>1 or (r->>'total')::numeric<>20 or (r->>'units')::int<>2 or r->'rows'->0->>'id'<>s::text then raise exception 'combined search / Jerusalem date / details failed';end if;
if (public.search_store_sales(p_reference=>pending::text)->>'count')::int<>0 then raise exception 'pending included';end if;
if (public.search_store_sales(p_reference=>g::text)->>'total')::numeric<>10 then raise exception 'special sale missing';end if;
if (public.get_store_finance()->>'income')::numeric<>baseline+30 then raise exception 'revenue mismatch';end if;
insert into public.finance_entries(entry_type,amount,entry_date,source_type,source_id) values('income',20,'2040-01-02','sale',s);
if (public.get_store_finance()->>'income')::numeric<>baseline+30 then raise exception 'duplicate revenue';end if;
perform public.set_feedback_email_setting('fixture@example.test');if public.get_feedback_email_setting()<>'fixture@example.test' then raise exception 'email setting failed';end if;
insert into public.customer_feedback(message) values('TEST rollback only') returning id into f;
if not public.claim_feedback_email(f) or public.claim_feedback_email(f) then raise exception 'concurrent dispatch claim';end if;
update public.feedback_email_dispatch set state='sent' where feedback_id=f;if public.claim_feedback_email(f) then raise exception 'duplicate mail';end if;
perform set_config('request.jwt.claim.sub','',true);
blocked:=false;begin perform public.get_store_finance();exception when others then blocked:=true;end;if not blocked then raise exception 'non-admin read';end if;
blocked:=false;begin perform public.set_feedback_email_setting('attacker@example.test');exception when others then blocked:=true;end;if not blocked then raise exception 'non-admin setting write';end if;
if has_function_privilege('anon','public.search_store_sales(date,date,text,text,numeric,numeric,text,text,integer,integer)','execute') or has_function_privilege('authenticated','public.claim_feedback_email(uuid)','execute') then raise exception 'unwanted privilege';end if;
end $$;
rollback;
select 'PASS: combined filters, Jerusalem dates, exact transaction items, paid-only and special-sale revenue, no duplicate income, shared email settings, dispatch idempotency and admin authorization; fixtures rolled back' as result;
