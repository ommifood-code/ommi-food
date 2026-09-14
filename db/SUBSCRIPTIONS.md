# Free launch — current policy

The application launches free. There are no subscription screens, payment requests, expiry gates, or billing API access for application roles. Administrators activate a reviewed kitchen directly, with explicit phone verification when needed. Existing order, contact and tracking improvements are retained.

`free_launch.sql` supersedes the earlier monthly subscription policy. The billing tables and dates remain private and dormant as groundwork only. Do not enable billing just by toggling a flag: future activation requires a separately reviewed interface and explicit product approval.

The intended future process is manual: transfer to the owner’s RIB, send a transfer-receipt image, owner checks receipt in the bank account, then reactivates the kitchen. No receipt-upload workflow or account details are introduced during the free launch.

Applied migrations: `free_launch_disable_billing`, followed by `disable_dormant_billing_api_during_free_launch`. Do not rerun these on the current database.

Verification: tests/subscriptions.sql checks free activation, administrator authority, phone verification, disabled billing and no expiry gate in a rolled-back transaction. Both DOM tests check absence of billing UI and direct activation. Existing private tables deliberately have no public RLS policies. Privileged activation still checks is_admin().
