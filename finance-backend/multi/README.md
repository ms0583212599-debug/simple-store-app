# Finance accounts and reusable subscriptions

Production finance-dashboard v4 uses verified owner login or a random, hashed, expiring account session. Every ledger request runs through finance_scoped with the server-resolved account. Caller-supplied account IDs do not select ownership.

Existing data belongs to the original owner account. The original finance-ivr endpoint stays available for that private account during rollout. finance-members-ivr is a separate endpoint with caller number + personal PIN. Do not point a public line at the old single-account endpoint.

## Implemented
- Per-account categories, entries, recurring items, budgets, audit, request idempotency and call state.
- Restricted finance_runtime role, account RLS policies, composite ownership foreign keys.
- Voice OTP challenge/registration/reset, PIN hashing, rate limits, expiring and revocable sessions, owner phone linking (database and prepared adapter).
- Website member/owner login, account details, independent subscriptions and administrator service/pricing management.
- Per-service first price, recurring price, month interval, one-time mode and trial setting. Finance defaults: 300 agorot first / 1000 renewal; payment required is OFF.
- Consent snapshots, duplicate provider-event handling, amount/currency validation, renewal preparation and cancellation gates. Provider payment references are never returned in customer responses.
- Atomic filtered/unfiltered HTML report download, up to 5000 rows, printable as PDF.
- Email verification, recipient-bound report delivery, throttling and provider idempotency prepared in delivery-routes.ts.
- Fax excluded.

## Release gates still closed
1. Automatic approval review rejected deployment of finance-provider-bridge to the store project. Reason: persistent public endpoint forwarding report content to Resend and OTP data to Yemot requires explicit approval of these providers/destinations. The bridge was NOT deployed. Production dashboard does not import delivery-routes.ts; auth_start/auth_verify/email/phone-link delivery routes return an explicit 503 and capabilities are false. No OTP or email was sent.
2. Billing provider adapter is NOT connected. No card capture page, provider tokenization, live charge worker or recurring charge schedule is active. Existing store checkout is not proof of recurring-payment permission. Choose and verify a provider (e.g. the existing Nedarim Plus account with documented recurring/token permissions) before enabling. No payment_required service can be enabled while provider_ready is false.
3. Account signup cannot go live until OTP delivery is approved/configured. The old private IVR is retained so existing use is not disrupted. Switch the configured extension to finance-members-ivr only after the owner's phone is verified and full telephone onboarding is tested.

## Activation after provider approval
- Deploy provider-bridge.ts as finance-provider-bridge in the store project. It accepts only HMAC-authenticated, timestamped requests; all downstream recipients originate from authenticated, throttled finance flows.
- Generate a new random shared bridge secret into the two protected integration tables, not source control. Configure the fixed bridge URL. Check the bridge's status: YEMOT_TOKEN and a verified-domain RESEND_API_KEY/from-address must exist. Never fall back to a public unauthenticated sender.
- Wire delivery-routes.ts into the currently gated dashboard routes and enable capabilities only after successful provider checks. Preserve owner authorization on phone_link endpoints.
- Connect phone-onboarding.ts to the members entry flow, persisting pending OTP challenge references across calls; PIN must never be persisted in call state. Registration requires completed OTP verification.
- Run actual registration/reset/email verification and report tests with an explicitly approved recipient. No live credentials or user card data belong in tests.
- For billing, provider adapter must verify callback signatures and bind server checkout reference, account, service, ILS currency and exact amount before calling internal billing functions. Do not trust browser success redirects. Unknown charges require provider reconciliation using the same charge UUID, never a new charge.

## Validation
SQL tests use BEGIN/ROLLBACK and preserve production data. test-accounts.sql covers signup, OTP/PIN rejection, session revocation, defaults, first 3 / renewal 10, duplicate notifications, cancellation and administrator access. tenant-test.sql verifies cross-account read, history, edit and foreign category rejection. test-api.mjs tests server identity; test-phone.mjs tests two separate callers; test-ui.mjs uses jsdom with mock authentication and verifies forms/pricing without actual login or charges.

SQL files are reviewed schema sources for an existing finance database, not a script to blindly replay on production. Deployed migrations are recorded in Supabase. Historical fix files are retained separately only where needed; do not run them after the final equivalent schema.
