# VendPay tenant management — 2026-10-20

Owner-only panel embedded in the existing store admin. Credentials (username, password, code, rememberMe, role) encrypted per tenant. Saving credentials disables the tenant and requires a new connection check. Connection checks perform login and read-only terminal status, checking HTTP and application errors.

Tenant door activation requires a successful connection check within the preceding hour and explicitly selected terminal_id/gate_status. Owner can disable and display private IVR configurations. Routing uses a derived tenant-specific HMAC key sent in POST body. No browser persistence or log output of the routing secret. Logout and tenant selection clear secret fields.

New `vendpay-tenant-ivr`: POST actions check/health/open, tenant isolation, active gate, hangup ignored, account-specific fresh authentication, explicit terminal configuration, persistent call deduplication. Unknown command outcomes are never retried. Receipt is not proof of physical opening.

Remote migration `vendpay_tenant_door_routing` added nullable terminal_id and gate_status to vendpay_tenants and service-role-only RLS table vendpay_tenant_door_operations, primary key (tenant_id,call_hash), status sending/sent/uncertain. No existing door/create/edit functions changed.

Tests: node tests/vendpay-tenant-auth.mjs; node tests/vendpay-tenant-routing.mjs (all outbound requests mocked). Physical telephone test pending. The existing tenant has not been activated automatically: its terminal mapping must be entered by the owner.

Remaining: tenant-specific create/edit membership functions are not connected to this router. Existing single-account membership extensions continue separately. Verify vendor authentication persistence across future token expiry. No sunset expiry semantics added.

## Self-service onboarding update
Inspected public vendor bundle /assets/index-BZhhkJbs.js on 2026-10-20: Login uses a constant default code, /terminal returns the hardware list, and openGateOnce sends gate_status=2 with terminal_id. The panel now needs username/password only, retrieves terminal_id/description from authenticated /terminal, and activation only accepts an ID from the account snapshot plus one-time-open command 2. New column discovered_terminals holds sanitized descriptions/IDs. No live door commands used in development. A fresh owner connection check is needed to populate existing accounts.

## Tenant member creation and editing — 2026-10-20

Deployed `vendpay-tenant-members` v1 and owner API v17. New owner-only configuration outputs `create_config` and `edit_config` use a management HMAC distinct from the door key. Original single-account create/edit/door functions are unchanged.

- Reuses deployed create v21 and edit v8 flows, including spoken/keyboard names, Hebrew dates, final confirmation and next Hebrew month expiry.
- Fetches active groups from the selected account's `/restrict_group` GET (observed in the public VendPay client). No fixed account-specific group IDs.
- Per-request credentials, token, groups and handlers. Separate tenant-scoped create/edit tables with RLS and service-role-only grants. Migration SQL snapshot: `docs/sql/vendpay-tenant-members.sql`; remote migration `vendpay_tenant_members`.
- POST/PUT is attempted at most once per operation; timeout and ambiguous results are not automatically replayed. Readback verifies success. Edit checks baseline changes and preserves the existing balance.
- Owner copies each configuration into a separate Yemot administrator extension protected by its entry code. The extension field in the site is a label, not automatic provisioning in Yemot.
- Validation: existing auth/routing tests and new member-flow mock integration test passed; real AES/HMAC, simultaneous tenant isolation with equal card/call/user IDs, group validation, explicit final consent, replay protection, unchanged balance and automatic expiry covered. Live endpoint rejects a wrong key with HTTP 401. Deployed sources are checked against the release.
- No real subscriber was created/changed during automated testing. Real phone onboarding/editing of the new tenant route still needs the owner's call; do not claim that physical end-to-end test completed.

## Operation journal — 2026-10-20

- `vendpay_operation_log` stores allowlisted metadata only: time, tenant (if known), source, action, result, HTTP status, duration, one-way call correlation hash. No bodies, passwords, keys, phone numbers or member names.
- Audit wrapper attached to original door/create/edit and tenant door/member endpoints. Runtime background task avoids delaying IVR; 2-second timeout and failure isolation prevent retries or changed action outcomes.
- Owner-authorized `operation_log` API merges the operation journal with existing management audit, supports tenant/action/ISO date filters, returns latest 200 matches, no-store. Website provides an Israel-time journal view and clears it on logout.
- Door success means command sent only. Prompt entries represent individual IVR steps, not completed mutations.
- Live read-only door health request persisted as `health`, HTTP 200. No door opened and no member modified by this verification. Earlier calls are not backfilled as new events.
