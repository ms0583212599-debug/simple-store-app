-- Service-only, serialized finalization after exact provider receipt verification.
create or replace function public.finalize_nedarim_online_sale(p_sale_id uuid,p_payment_reference text)
returns void language plpgsql security invoker set search_path='' as $$
declare current_status text; current_reference text;
begin
 if coalesce(p_payment_reference,'')='' then raise exception 'Missing provider receipt'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_payment_reference,0));
 select status,payment_reference into current_status,current_reference from public.sales where id=p_sale_id for update;
 if not found then raise exception 'Missing sale'; end if;
 if current_status='paid' then
  if current_reference=p_payment_reference then return; end if;
  raise exception 'Sale already has another receipt';
 end if;
 if current_status<>'pending' then raise exception 'Sale is not pending'; end if;
 if exists(select 1 from public.sales where payment_reference=p_payment_reference and id<>p_sale_id) then raise exception 'Receipt already used'; end if;
 perform public.finalize_paid_sale(p_sale_id,p_payment_reference);
end;
$$;
revoke all on function public.finalize_nedarim_online_sale(uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_nedarim_online_sale(uuid,text) to service_role;
