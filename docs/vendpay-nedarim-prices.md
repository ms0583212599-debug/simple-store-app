# Scheduled category minimums

Each bound tenant can select a Nedarim category, set a base minimum and up to 30 nonoverlapping weekly periods, then explicitly enable automatic updates. Israel local time is used, including DST. Overnight and full-day ranges are supported. Outside periods the base minimum applies. Disabling retains the last provider amount.

The separate minute scheduler writes at most three changed amounts per institution per run. It uses GetNewGroupe and SaveEditGroupe, writes only Id, unchanged Name and Amount, and verifies by reading back. Physical terminal refresh latency is provider-dependent. No fixed-price enforcement is promised: Amount is the provider minimum.

Private tables, owner-gated administration, revision checks and leases prevent stale edits and institution rebinding during a price write. Provider credentials stay encrypted server-side. No schedules were created on deployment; existing provider amounts remain unchanged. Provider write permission and terminal display need verification after the first user-enabled schedule.

Validation: Node tests cover decimal precision, half-open boundaries, overnight/week wrap, overlaps, DST, full days, minimal provider payload, readback, unchanged and empty configurations. SQL transaction/rollback checks cover revision, tenant isolation and active leases.
