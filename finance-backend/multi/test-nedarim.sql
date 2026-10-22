do $$
declare s uuid;c jsonb;c2 jsonb;r jsonb;owner_id uuid:='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';n int;
begin
 insert into public.billing_services(slug,name,payment_required,first_amount,renewal_amount,provider_ready)values('test-nedarim-rollback','בדיקה',true,300,300,true)returning id into s;
 c:=public.billing_nedarim_begin(owner_id,s,1,'1234567');
 c2:=public.billing_nedarim_begin(owner_id,s,1,'1234567');
 if c->>'id'<>c2->>'id' or (c2->>'claimed')::boolean then raise exception 'duplicate_checkout';end if;
 perform public.billing_nedarim_bind((c->>'id')::uuid,'1234567','7654321');
 if exists(select 1 from public.billing_subscriptions where id=(c->>'subscription_id')::uuid and paid_until is not null)then raise exception 'setup_granted_access';end if;
 begin perform public.billing_nedarim_payment((c->>'id')::uuid,'111',100,current_date);raise exception 'bad_amount_accepted';exception when others then if sqlerrm<>'amount_mismatch' then raise;end if;end;
 perform public.billing_nedarim_payment((c->>'id')::uuid,'111',300,current_date);
 perform public.billing_nedarim_payment((c->>'id')::uuid,'111',300,current_date);
 select count(*) into n from public.billing_charges where subscription_id=(c->>'subscription_id')::uuid;
 if n<>1 then raise exception 'duplicate_charge';end if;
 if not exists(select 1 from public.billing_subscriptions where id=(c->>'subscription_id')::uuid and status='active' and paid_until>now())then raise exception 'payment_not_applied';end if;
 perform public.billing_manage(owner_id,'cancel',jsonb_build_object('service_id',s));
 if not exists(select 1 from public.billing_subscriptions where id=(c->>'subscription_id')::uuid and status='cancelled' and paid_until>now())then raise exception 'paid_access_lost';end if;
end $$;
