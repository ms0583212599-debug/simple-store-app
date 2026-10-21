# Door-only payment rules

An open action requires an approved matching payment, but no Comments or membership card. Comments are ignored and not stored for door-only events. The worker skips member authentication/list lookup; the existing tenant door handler authenticates the configured tenant and sends one idempotent door command. Renew and both still require a valid membership card in Comments. Existing processed/review events are never replayed automatically.
