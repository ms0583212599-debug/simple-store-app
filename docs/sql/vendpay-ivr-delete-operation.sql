-- Applied as migration vendpay_ivr_delete_session_operation.
-- Reuse existing tenant-scoped, unique in-flight locks for edits and deletes.
alter table public.vendpay_tenant_edit_sessions
 add column if not exists operation text not null default 'edit' check (operation in ('edit','delete'));
alter table public.vendpay_admin_edit_sessions
 add column if not exists operation text not null default 'edit' check (operation in ('edit','delete'));
