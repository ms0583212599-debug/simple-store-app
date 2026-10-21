# Per-client Nedarim configuration

Each VendPay tenant has one institution binding and encrypted API key. Institution numbers are unique among bound tenants. A replaced connection is disabled and unbound; historic events and rules are preserved. Credentials remain AES-GCM bound to institution number.

Existing rules migrate with stable UUIDs and retain their actions. Atomic service-role-only RPCs add/edit/delete individual rules, reject duplicate categories and cross-client writes. Owner authentication is still required for every admin route. Legacy institution-wide admin routes reject writes and request a refresh.

The separate dialog uses np_load, np_connect, np_categories, np_rule_save and np_rule_delete. Category options come from the institution's online GetMosad endpoint NewGroupe list, including categories without history. Redirected categories cannot be newly selected. Rules still match exact normalized category names; renamed categories need editing.

New or reattached institutions initialize from history without actions before processing future transactions. A scheduler invokes each enabled bound institution separately with its mosad. Workers validate every rule belongs to the connection's tenant. Existing connection cursors and enabled state are retained.

Tests cover category parsing, unknown/redirected categories, institution mismatch, CRUD and tenant isolation in a rolled-back database transaction. The existing member renewal regression suite passes. No synthetic real payment or door command is used in verification.
