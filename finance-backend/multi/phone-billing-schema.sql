alter table public.billing_nedarim_checkouts add column channel text not null default 'web' check(channel in('web','phone'));
alter table public.billing_nedarim_checkouts add column phone_context jsonb;
alter table public.billing_nedarim_checkouts add column phone_issued_at timestamptz;

create function public.billing_nedarim_phone_begin(p_account uuid,p_service uuid,p_revision integer,p_mosad text,p_entry text,p_extension text,p_token_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j jsonb;e public.finance_entry_calls;c public.billing_nedarim_checkouts;
begin
 select * into e from public.finance_entry_calls where id=p_entry and account_id=p_account and authenticated_until>now();
 if not found or p_extension!~'^/[A-Za-z0-9/_-]*$' or length(p_extension)>150 or p_token_hash!~'^[a-f0-9]{64}$' then raise exception 'unauthorized';end if;
 j:=public.billing_nedarim_begin(p_account,p_service,p_revision,p_mosad);
 if (j->>'claimed')::boolean then
  update public.billing_nedarim_checkouts set channel='phone',phone_context=jsonb_build_object('entry',p_entry,'extension',p_extension,'phone',e.phone,'token_hash',p_token_hash) where id=(j->>'id')::uuid returning * into c;
  return to_jsonb(c)||'{"claimed":true}'::jsonb;
 end if;
 return j;
end $$;

create function public.billing_nedarim_phone_issue(p_checkout uuid,p_entry text,p_token_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.billing_nedarim_checkouts;
begin
 select * into c from public.billing_nedarim_checkouts where id=p_checkout for update;
 if not found or c.channel<>'phone' or c.phone_context->>'entry'<>p_entry or c.phone_context->>'token_hash'<>p_token_hash or c.cancel_requested or c.state<>'ready' or c.phone_issued_at is not null or c.created_at<now()-interval '1 hour' then return '{"issued":false}';end if;
 if not exists(select 1 from public.finance_entry_calls where id=p_entry and account_id=c.account_id and authenticated_until>now()) then return '{"issued":false}';end if;
 update public.billing_nedarim_checkouts set phone_issued_at=now() where id=c.id;
 return jsonb_build_object('issued',true,'amount',c.amount,'mosad',c.mosad);
end $$;

-- Serialize against issue: an unissued phone form can be safely abandoned, unlike a live web checkout.
create function public.billing_nedarim_phone_abandon(p_checkout uuid,p_account uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.billing_nedarim_checkouts;
begin
 select * into c from public.billing_nedarim_checkouts where id=p_checkout and account_id=p_account for update;
 if not found or c.channel<>'phone' or c.phone_issued_at is not null or c.keva_id is not null then return false;end if;
 update public.billing_nedarim_checkouts set state='cancelled',cancel_requested=true where id=c.id;
 perform public.billing_manage(p_account,'cancel',jsonb_build_object('service_id',c.service_id));return true;
end $$;
revoke all on function public.billing_nedarim_phone_begin(uuid,uuid,integer,text,text,text,text),public.billing_nedarim_phone_issue(uuid,text,text),public.billing_nedarim_phone_abandon(uuid,uuid) from public,anon,authenticated;
grant execute on function public.billing_nedarim_phone_begin(uuid,uuid,integer,text,text,text,text),public.billing_nedarim_phone_issue(uuid,text,text),public.billing_nedarim_phone_abandon(uuid,uuid) to service_role;
