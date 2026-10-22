# Shared monthly billing with Nedarim Plus

Implemented: server-created, amount-locked monthly checkout; hosted Nedarim iframe; raw-body HMAC verification; provider-side mandate confirmation; recurring read-only reconciliation; account-scoped cancellation which freezes and verifies the mandate before claiming success; separate service catalogs and consent snapshots. No card number or CVV reaches our API.

## Activation

1. Save institution ID, ApiValid and an API key in the website's administrator provider settings.
2. Enable HMAC in Nedarim and save the SAME `whsec_...` signing key in our settings. Do not rotate an existing key used by another application without coordinating it. Required management actions: GetWebhook, GetKevaId, DisableKeva. ApiValid is used only by our server to create transactions.
3. Run the dedicated Nedarim connection check. It submits Amount=0 (documented validation-only request), and checks signing configuration. It never charges.
4. Save a service, then edit it to require payment. Supported provider plan: recurring, interval_months=1, equal first/renewal amounts, trial_days=0. Other plans remain gated.
5. A real end-to-end enrollment, payment confirmation and cancellation must be verified with the owner's configured provider before declaring production readiness. No real charge has been made by this implementation.

Checkout callbacks are per transaction and use:
`https://icldwmvkbeanyypkpeia.supabase.co/functions/v1/finance-nedarim-webhook?checkout=<server-issued-id>`
There is no automatic overwrite of institution-wide callbacks (other applications may use them).
The worker checks bound mandates every 15 minutes, oldest-first, 15 per invocation. At larger scale increase capacity before exceeding this throughput. First charge is separate from mandate creation; it can take approximately three hours according to the supplied Nedarim documentation. Access starts only after a successful provider history entry. Paid access is retained after cancellation.

## New service integration

Create a unique slug in the website's service administration. Server-authenticated callers reuse dashboard `action=billing`:
- `{action:'catalog'}` lists terms.
- `{action:'checkout',data:{service_id,revision,consent:true}}` uses the current authenticated account, ignores caller-supplied account IDs, and returns checkout_id plus provider TransactionId/Key.
- Embed `https://www.matara.pro/nedarimplus/iframe/v3/` with those TransactionId/Key parameters. Verify message origin AND source; browser events are only hints to refresh server status.
- `{action:'checkout_status',data:{checkout_id}}` returns that account's status.
- `{action:'access',data:{service:'your-slug'}}` checks that account's entitlement. Enforce it on the NEW SERVICE'S SERVER before serving protected data, not only in browser code. New website origins require explicit registration in the dashboard allowlist; arbitrary origins are not accepted.
- `{action:'cancel',data:{service_id}}` stops that service only.
Use the existing authenticated account session. Do not embed service-role keys, management API passwords or webhook secrets in a client.

## Phone status

The multi-user IVR cancellation path uses the same provider-confirmed cancellation as the website. Phone-only enrollment/collection is NOT implemented in this change. It requires integrating Yemot's native credit_card flow and correlating its result with a verified Nedarim mandate. The original private IVR remains unchanged; the multi-user endpoint has not been switched into the live extension.

## Operational edge cases

An uncertain CreateTransaction response is retained as unknown rather than automatically retried. A provider checkout ID has no expiry/revocation API; an abandoned checkout must not silently be replaced, or it could establish an extra mandate later. A cancellation requested before mandate binding is retained and executed when the callback binds it; the UI does not claim completion early. Missing initial callbacks / unknown checkouts require operator reconciliation before resubmission. Bound mandates reconcile independently of institution-wide webhooks.

Nedarim manual price changes are reflected by verified history. The first successful charge must match accepted terms; subsequent actual provider charges are recorded. The app never schedules a second debit in parallel with Nedarim's own recurring collection. Changing the website's price applies to future enrollments only. Disabling signup/payment requirements does not itself cancel already-existing mandates.

## Validation

`node test-nedarim.mjs` tests HMAC replay/tampering, monetary/date validation, checkout request shape and idempotent provider-confirmed cancellation using mocked network responses.
`test-nedarim.sql` must be run within a transaction ending in ROLLBACK. It tests concurrent-style repeated checkout requests, no access from mandate setup alone, first-charge amount enforcement, duplicate event suppression and retention of paid access after cancellation.
Existing API, website script order, UI, phone isolation and provider settings tests pass. Live API rejects unsigned requests. No card credentials or real provider charge were used in tests.
