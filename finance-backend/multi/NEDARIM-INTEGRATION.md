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

## Phone enrollment and cancellation

The multi-user endpoint `finance-members-ivr` now routes unpaid accounts (including immediately after signup or login) to enrollment, status and cancellation. It reads the current catalog, speaks the monthly price, and records a revision-checked consent before opening card collection. Active members retain the existing account menu and cancellation option 8.

The server creates an isolated, non-dialable `FinancePay<checkout UUID>` API extension using Yemot UpdateExtension, then verifies its effective configuration with GetIVR2Dir. It sets native Nedarim `credit_card_payment_type=keva`, unlimited months, ILS, fixed amount and a unique `finance-<checkout UUID>` category. Native Yemot collects the card; our endpoint requests no card details and never trusts CreditCard_CODE as proof of payment. This internal category replaces the general category for phone enrollments and must not be edited in Nedarim, because it identifies the mandate.

`finance-payment-ivr` requires a random token (only its hash is in our DB), the originating verified account session, caller phone, call ID and extension. Card collection is issued once, atomically. Replayed or cross-caller requests cannot launch it again. Web and phone share one open checkout per subscription. Failed setup before collection can be safely cancelled and retried. Once collection was issued, uncertain outcomes are retained for reconciliation, including a dropped call; no automatic second mandate is opened.

A signed Nedarim mandate callback must match the unique category, institution, verified caller, amount, currency and monthly frequency. It binds the mandate without granting paid access. The same worker and verified payment history as the website activate access and stop future charges on cancellation.

### Configure from the website

Save Yemot token, enable voice, and save Nedarim credentials/signature. Click **חיבור הרשמה טלפונית לנדרים**. This registers the Keva callback only if empty/already ours, with no Force override. It requires SetWebhook permission. If another app already owns Keva notifications, coordinate a signed raw-body relay; do not replace it. Connection check displays phone readiness separately. Runtime preparations additionally verify the exact effective Yemot extension configuration.

The main public finance extension must use:
`api_link=https://icldwmvkbeanyypkpeia.supabase.co/functions/v1/finance-members-ivr`
Keep its existing private finance_key and use POST. Do not expose that key in repository files. Link the owner's phone through the existing authenticated owner website before switching the old private endpoint, so old records remain accessible. The old private endpoint is still unchanged; this deployment does not silently repoint the live line.

No live card collection or debit has been tested. Confirm one real signup, signed callback, first charge and cancellation with the configured institution and an explicitly approved card before public launch. Expired/spent payment extensions no longer authorize collection; they can be removed later from Yemot after reconciliation. Initial callback loss still requires operator reconciliation; phone enrollment is gated if the institution callback is missing.

## Operational edge cases

An uncertain CreateTransaction response is retained as unknown rather than automatically retried. A provider checkout ID has no expiry/revocation API; an abandoned checkout must not silently be replaced, or it could establish an extra mandate later. A cancellation requested before mandate binding is retained and executed when the callback binds it; the UI does not claim completion early. Missing initial callbacks / unknown checkouts require operator reconciliation before resubmission. Bound mandates reconcile independently of institution-wide webhooks.

Nedarim manual price changes are reflected by verified history. The first successful charge must match accepted terms; subsequent actual provider charges are recorded. The app never schedules a second debit in parallel with Nedarim's own recurring collection. Changing the website's price applies to future enrollments only. Disabling signup/payment requirements does not itself cancel already-existing mandates.

## Validation

`node test-nedarim.mjs` tests HMAC replay/tampering, monetary/date validation, checkout request shape and idempotent provider-confirmed cancellation using mocked network responses.
`test-nedarim.sql` must be run within a transaction ending in ROLLBACK. It tests concurrent-style repeated checkout requests, no access from mandate setup alone, first-charge amount enforcement, duplicate event suppression and retention of paid access after cancellation.
Existing API, website script order, UI, phone isolation and provider settings tests pass. Live API rejects unsigned requests. No card credentials or real provider charge were used in tests.

Phone validation: `test-phone-payment.mjs` (native configuration, account/call/token isolation, replay and signed callback mismatch); `test-phone-billing.mjs` (consent, changed terms, duplicates, explicit cancellation and setup recovery); `test-phone-billing.sql` (transactional issue/abandon, cross-channel reuse, event deduplication and restricted RPC permissions, always ROLLBACK).
