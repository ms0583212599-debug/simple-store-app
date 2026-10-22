alter table public.finance_categories add column revision integer not null default 1;
create function public.finance_category_save(p_id bigint,p_kind text,p_name text,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v public.finance_categories; n text:=btrim(p_name); code text;
begin
 if n is null or char_length(n)<1 or char_length(n)>60 or n ~ '[.=&<>[:cntrl:]]' or p_kind is null or p_kind not in ('income','expense') then raise exception 'invalid_category'; end if;
 perform pg_advisory_xact_lock(72396481);
 if exists(select 1 from public.finance_categories where kind=p_kind and lower(btrim(name))=lower(n) and (p_id is null or id<>p_id)) then raise exception 'duplicate_name'; end if;
 if p_id is null then
   select i::text into code from generate_series(1,9) i where not exists(select 1 from public.finance_categories where kind=p_kind and dial_code=i::text) order by i limit 1;
   if code is null then raise exception 'no_free_key'; end if;
   insert into public.finance_categories(kind,name,dial_code) values(p_kind,n,code) returning * into v;
 else
   select * into v from public.finance_categories where id=p_id for update;
   if not found then raise exception 'category_missing'; end if;
   if v.kind<>p_kind then raise exception 'kind_locked'; end if;
   if p_revision is null or v.revision<>p_revision then raise exception 'category_changed'; end if;
   update public.finance_categories set name=n,revision=revision+1 where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end $$;
revoke all on function public.finance_category_save(bigint,text,text,integer) from public,anon,authenticated;
grant execute on function public.finance_category_save(bigint,text,text,integer) to service_role;
