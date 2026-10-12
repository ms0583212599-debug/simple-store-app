-- Proposed service-only finalization wrapper. Not applied to production.
create or replace function public.finalize_nedarim_online_sale(p_sale_id uuid,p_payment_reference text)
returns void language plpgsql security invoker set search_path='' as $$
declare current_status text;
begin
 if coalesce(p_payment_reference,'')='' then raise exception 'Missing provider receipt'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_payment_reference,0));
 select status into current_status from public.sales where id=p_sale_id for update;
 if not found then raise exception 'Missing sale'; end if;
 if current_status='paid' then return; end if;
 if current_status<>'pending' then raise exception 'Sale is not pending'; end if;
 if exists(select 1 from public.sales where payment_reference=p_payment_reference and id<>p_sale_id) then raise exception 'Receipt already used'; end if;
 perform public.finalize_paid_sale(p_sale_id,p_payment_reference);
end;
$$;
revoke all on function public.finalize_nedarim_online_sale(uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_nedarim_online_sale(uuid,text) to service_role;
