# VendPay tenant management — 2026-10-20

Owner-only panel embedded in the existing store admin. Credentials (username, password, code, rememberMe, role) encrypted per tenant. Saving credentials disables the tenant and requires a new connection check. Connection checks perform login and read-only terminal status, checking HTTP and application errors.

Tenant door activation requires a successful connection check within the preceding hour and explicitly selected terminal_id/gate_status. Owner can disable and display private IVR configurations. Routing uses a derived tenant-specific HMAC key sent in POST body. No browser persistence or log output of the routing secret. Logout and tenant selection clear secret fields.

New `vendpay-tenant-ivr`: POST actions check/health/open, tenant isolation, active gate, hangup ignored, account-specific fresh authentication, explicit terminal configuration, persistent call deduplication. Unknown command outcomes are never retried. Receipt is not proof of physical opening.

Remote migration `vendpay_tenant_door_routing` added nullable terminal_id and gate_status to vendpay_tenants and service-role-only RLS table vendpay_tenant_door_operations, primary key (tenant_id,call_hash), status sending/sent/uncertain. No existing door/create/edit functions changed.

Tests: node tests/vendpay-tenant-auth.mjs; node tests/vendpay-tenant-routing.mjs (all outbound requests mocked). Physical telephone test pending. The existing tenant has not been activated automatically: its terminal mapping must be entered by the owner.

Remaining: tenant-specific create/edit membership functions are not connected to this router. Existing single-account membership extensions continue separately. Verify vendor authentication persistence across future token expiry. No sunset expiry semantics added.

## Self-service onboarding update
Inspected public vendor bundle /assets/index-BZhhkJbs.js on 2026-10-20: Login uses a constant default code, /terminal returns the hardware list, and openGateOnce sends gate_status=2 with terminal_id. The panel now needs username/password only, retrieves terminal_id/description from authenticated /terminal, and activation only accepts an ID from the account snapshot plus one-time-open command 2. New column discovered_terminals holds sanitized descriptions/IDs. No live door commands used in development. A fresh owner connection check is needed to populate existing accounts.
