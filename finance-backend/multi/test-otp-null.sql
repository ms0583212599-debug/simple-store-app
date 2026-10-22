begin;
do $$ declare c jsonb;r jsonb;a uuid;ec jsonb;begin
 c:=public.finance_account_auth('challenge','{"phone":"0509998877","purpose":"register","code":"123456"}'::jsonb);
 r:=public.finance_account_auth('verify',jsonb_build_object('phone','0509998877','challenge_id',c->>'challenge_id','pin','123456'));
 if r->>'error'<>'invalid_code' or r->>'error' is null then raise exception 'missing OTP accepted';end if;
 r:=public.finance_account_auth('verify',jsonb_build_object('phone','0509998877','challenge_id',c->>'challenge_id','pin','123456','code','123456'));
 if r->>'account_id' is null then raise exception 'valid OTP failed %',r;end if;a:=(r->>'account_id')::uuid;
 ec:=public.finance_profile(a,'email_start','{"email":"test@example.org","code":"234567"}'::jsonb);
 r:=public.finance_profile(a,'email_verify',jsonb_build_object('challenge_id',ec->>'challenge_id'));
 if r->>'error' is distinct from 'invalid_code' then raise exception 'missing email OTP accepted';end if;
 r:=public.finance_profile(a,'email_verify',jsonb_build_object('challenge_id',ec->>'challenge_id','code','234567'));
 if r->>'ok' is distinct from 'true' then raise exception 'valid email OTP failed %',r;end if;
end $$;
rollback;
