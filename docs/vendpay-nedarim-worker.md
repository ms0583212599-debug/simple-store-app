# Nedarim Plus → VendPay
Institution: 7014693. Storefront institution 7019225 is independent.

The private scheduled worker checks GetHistoryJson every minute using forward LastId pagination. Gateway JWT verification remains on; a second private x-worker-token is required and its SHA-256 is pinned. The token lives only in Vault VENDPAY_NEDARIM_WORKER. HTTP queue tables deny public, anon and authenticated access.

The initial cursor is 81353374, the newest observed historical payment. Do not reset the cursor or delete event claims. Activation is separate from schema installation. Only new transaction IDs are processed. No existing payment is replayed when rules change.

Exact NFC-trimmed Groupe matches a unique user-saved rule. Comments must contain only the positive numeric membership card. Automatic execution accepts regular positive ILS payments with a nonzero confirmation number; other matched payments become review_payment. Refunds, installments and standing orders are not automated. No minimum price is configured.

renew uses the phone's nextHebrewMonthStart algorithm, anchors the target date in the event and never shortens a longer expiry. The existing verified edit handler, concurrency checks and member lock are reused. Balance and other fields are preserved.
open and both use the existing single-attempt tenant door handler. Both renews first; failed/uncertain renewal does not open. A door command acknowledgement does not prove physical opening.

A unique institution/transaction event is claimed before any external mutation. Replays and unknown outcomes never send another mutation. An interrupted processing event needs manual review; it is not silently retried. The global lease expires after five minutes. At most five matched events are processed per invocation.

Owner-only nedarim_worker API shows recent outcomes with masked membership card numbers. No payer details or Nedarim credentials are returned.

Validation: node supabase/functions/vendpay-nedarim-worker/worker.test.mjs
Live preflight authenticated to the saved tenant and verified member payload schema. No real matched payment or physical door test has occurred as of initial activation; first new payment must be checked in the UI.

To pause, set enabled=false in vendpay_nedarim_worker_state. Resume preserves the cursor and therefore processes backlog; inspect pending payments first, particularly door actions. Do not retry uncertain actions before reviewing the provider and edit/door ledgers.
