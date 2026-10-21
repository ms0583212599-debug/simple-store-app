select cron.schedule('vendpay-nedarim-every-minute','* * * * *',$job$
select net.http_post(
 url:='https://ksddrcalmszxxcuxoznd.supabase.co/functions/v1/vendpay-nedarim-worker',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZGRyY2FsbXN6eHhjdXhvem5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDc1MzAsImV4cCI6MjEwMzA4MzUzMH0.BiGs-0QjSOIkUbW05WK0-Yd3wxdZDHKTTQZ0swxHvls','x-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='VENDPAY_NEDARIM_WORKER')),
 body:='{"mode":"run"}'::jsonb,
 timeout_milliseconds:=120000
)
where exists(select 1 from public.vendpay_nedarim_worker_state where mosad='7014693' and enabled);
$job$);