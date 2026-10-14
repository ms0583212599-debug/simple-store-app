# Customer quantity promotions

Product editing exposes enable/disable, required quantity (2–9999) and the total bundle price. One active bundle per product; every complete group receives that price, with remaining units at the regular price. Example: unit10 / bundle2-for18 -> quantities1,2,3,4 cost10,18,28,36. Special-sale manager pricing is unchanged.

Website and Android use integer cents for cart display. Server `create_sale` independently reads current catalog prices, groups repeated product IDs before pricing/stock validation, and creates the sale atomically. Bundle totals are split into per-unit cent rows so generated line totals, quantities, inventory changes and cost snapshots stay exact even for 3-for25. The create-checkout Edge Function delegates to this RPC. Calculator/general-amount checkout remains supported.

No existing product was automatically put on promotion. A price change incompatible with an enabled promotion is rejected until its offer is adjusted or disabled. Existing tablet versions must update to display the offer correctly; checkout already uses the server price.

Tests: rollback-only SQL covers regular/active/disabled offers, complete and repeated groups, remainder, duplicate IDs, exact cents, ignored client prices, cost snapshots, inventory finalization, insufficient stock, invalid quantities and rollback. Browser tests cover product editing, validation, badges and cart totals. API33 instrumentation checks the same pricing rules and existing payment/keyboard/update regressions. No real charge was made.

Tested source: 87446065867357376c5b9af9dc73c2d4ed7e4718. Workflow: 38627444085. APK10082 SHA256: 367f8150f1598ecc4e9e559a7676de35c94d8ea9b5540444952e8f22bab0d340
