do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c bigint;t jsonb;r jsonb;d date:=(now()at time zone 'Asia/Jerusalem')::date;begin
insert into public.finance_accounts(id)values(a),(b);
insert into public.finance_categories(account_id,kind,name,dial_code)values(a,'expense','בדיקה','1')returning id into c;
t:=public.finance_scoped(a,'transaction_save',jsonb_build_object('kind','expense','category_id',c,'amount_agorot',123,'flow_type','annual','occurred_on',d),'test-tenant-123456');
r:=public.finance_scoped(b,'read',jsonb_build_object('mode','item','id',t->'id'));assert r is null,'cross-account read';
r:=public.finance_scoped(b,'read',jsonb_build_object('mode','history','id',t->'id'));assert jsonb_array_length(r->'rows')=0,'cross-account history';
begin perform public.finance_scoped(b,'void',jsonb_build_object('id',t->'id','revision',1),'test-tenant-void123456');raise exception 'FAILED cross-account write';exception when raise_exception then if sqlerrm<>'not_found' then raise;end if;end;
begin perform public.finance_scoped(b,'transaction_save',jsonb_build_object('kind','expense','category_id',c,'amount_agorot',123,'flow_type','annual','occurred_on',d),'test-tenant-foreign123456');raise exception 'FAILED foreign category';exception when raise_exception then if sqlerrm<>'invalid_category' then raise;end if;end;
r:=public.finance_scoped(a,'read',jsonb_build_object('from',d,'to',d));assert (r->>'expense')::int=123,'own report';
r:=public.finance_scoped(b,'read',jsonb_build_object('from',d,'to',d));assert (r->>'expense')::int=0,'other report';
perform public.finance_scoped(b,'category_save',jsonb_build_object('kind','expense','name','בדיקה'),'test-tenant-cat123456');
r:=public.finance_scoped(b,'read',jsonb_build_object('mode','categories'));assert jsonb_array_length(r->'rows')=1,'independent categories';
end $$;
