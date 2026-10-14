# Financial summary (10081)

- Website and Android use `get_financial_summary`, protected by store-admin authorization.
- Recorded balance = paid sales + other recorded income - stock purchases - other expenses. This is not a bank-settlement statement.
- Estimated gross profit = sales - cost of sold items. Estimated net profit additionally subtracts other expenses; manual other income is excluded.
- Existing ordinary sales have no historical cost snapshot. No historical costs were fabricated from current product prices. Profit is null when any selected sale lacks complete cost, including general-amount sales without itemized products.
- New sale items capture the positive average-cost / last-purchase-cost fallback privately at item creation. Later product-price changes do not rewrite snapshots. Zero/unknown costs are conservatively treated as missing.
- Special-sale cost uses its existing saved unit cost. Their actual payment method was not recorded and is explicitly labelled unknown.
- Refunds and bank settlements are not independently modelled; the screen states this. Expenses and fees are included only when recorded.
- Periods use Asia/Jerusalem, week begins Sunday. Server pagination is 50 rows; summary totals cover the complete selected period.
- Verification: rollback-only `tests/financial-summary.sql`, browser financial filters/drilldown/missing-cost display, Android compile and API33 update/keyboard regression.
- Tested source: 208bfd823ace8490cd05e45383f586e4c621d7f2; workflow 38583813231. Published APK version 10081, SHA256 98d4668f1db97ef04492a6b84de9add31c080600b432ff2f9dfad807e80e2075.
