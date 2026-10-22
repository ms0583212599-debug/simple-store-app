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

## Approved delivery integration — October 22, 2026
The user explicitly approved Yemot voice OTP and Resend verified-email report delivery. The HMAC-authenticated finance-provider-bridge is deployed in the store project. A fresh shared secret is stored only in protected integration tables. Dashboard delivery routes are connected and capabilities follow provider readiness. Members IVR includes registration/reset, returning after receiving an OTP call, email address entry through EmailKeyboard, verification and filtered/full report sending. OTP and PIN values are not persisted in phone call state.

Live authenticated status returned mail_ready=false and voice_ready=false. YEMOT_TOKEN is absent. Mail requires RESEND_API_KEY and FINANCE_FROM_EMAIL (or FEEDBACK_FROM_EMAIL) from a verified sending domain; at least one is missing/unusable. No OTP or email was sent. Configure these secrets in store project ksddrcalmszxxcuxoznd, then test a user-approved recipient. Do not paste credentials in Git or chat. Presence checks do not prove provider delivery or balance.

Original private IVR remains unchanged. Switch to finance-members-ivr only after verifying the owner's phone through existing administrator login and testing real OTP onboarding. New accounts must never use the old private endpoint.

Billing adapter/card tokenization/live renewal worker remain unconnected. payment_required stays disabled while provider_ready is false. No charges were made. Fax remains excluded.

Missing/null OTP is rejected in both database verification functions. Reset/link revokes web sessions and authenticated phone calls. Public registration verification cannot consume owner-link challenges; authenticated linking verifies challenge ownership.

## Validation
SQL tests use BEGIN/ROLLBACK and preserve production data. test-accounts.sql covers signup, OTP/PIN rejection, session revocation, defaults, first 3 / renewal 10, duplicate notifications, cancellation and administrator access. tenant-test.sql verifies cross-account read, history, edit and foreign category rejection. test-api.mjs tests server identity; test-phone.mjs tests two separate callers; test-ui.mjs uses jsdom with mock authentication and verifies forms/pricing without actual login or charges.

SQL files are reviewed schema sources for an existing finance database, not a script to blindly replay on production. Deployed migrations are recorded in Supabase. Historical fix files are retained separately only where needed; do not run them after the final equivalent schema.

## Administrator provider settings
Existing owner login → Services → הגדרות ימות ומייל. Provider tokens are write-only, stored as AES-GCM ciphertext in the RLS-closed store credentials table. The encryption key is derived with SHA-256 from a domain-separated runtime service-role secret; rotating that runtime secret requires re-entering provider keys. No keys are put in local/session storage, logs or returned responses. Blank key fields preserve existing keys; independent switches stop voice/email. Both the dashboard and bridge validate the existing store owner session before settings access. Saves use an optimistic revision. Checks call Yemot GetSession and Resend domains without sending messages. Resend sending-only keys may not permit domain inspection; the UI does not misreport that limitation as a proven invalid key.
