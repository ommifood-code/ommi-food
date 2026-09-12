# Immediate kitchen activation — implemented

Free-launch chef_register now creates active/honorary/active kitchens without falsifying phone verification. The existing publication guard and RLS allow unverified phones only during the free launch. New orders remain pending, and chef acceptance reserves portions atomically. No existing orders or accounts were converted. Phone changes continue to invalidate verification and hide the account; administrative suspension still blocks public visibility and booking.

Applied migration: activate_kitchens_on_registration_keep_order_acceptance. Source: db/immediate_kitchen_only.sql. Do not apply the removed immediate_kitchen_and_auto_confirm.sql.

Verified on the live database with rollback-only tests/immediate-kitchen.sql: actual registration, anonymous kitchen/offer visibility and ordering, pending status, no early allocation, chef acceptance, idempotent cancellation and suspended-kitchen protections. Both DOM suites pass. Browser end-to-end testing by the user remains separate.

Paid launch is still disabled. Do not enable billing without reviewing all publication and administrative UX rules together.
