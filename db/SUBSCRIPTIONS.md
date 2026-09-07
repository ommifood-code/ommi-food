# Monthly subscription release

50 MAD per calendar month, paid manually through Cash Plus. No order commission, automatic debit, paid messaging, advertising, or boost integration.

Apply `monthly_subscriptions.sql`, followed by `subscription_order_guards.sql` in one migration after the existing preorder schema. They were applied together as `monthly_cashplus_subscriptions_and_order_contact`; do not rerun them on the existing database.

The administrator enters the real recipient instructions in the subscription section. Until instructions are saved, the chef cannot submit a payment claim. Only the receipt reference is stored, never a cash withdrawal code or publicly hosted receipt photograph. Recording a reference does not activate membership. The administrator checks actual receipt outside the app and confirms it. Confirmation adds one month from the later of confirmation time or current expiry; retries cannot add a second month. Rejected claims include a correction reason.

Publishing can be combined with payment confirmation. Phone ownership must be explicitly confirmed if not previously verified. Existing honorary memberships are preserved. Paid expiry blocks discovery and new orders/acceptances; previously accepted orders can still be prepared and delivered. Suspended kitchens are not silently republished by a payment-only confirmation.

Customer contact appears only through a valid private order capability. Pickup address remains hidden until acceptance. WhatsApp opens a user-initiated message containing the ordinary order reference, never the private tracking token. Tracking links put the private token in the URL fragment and remove it after loading. Notifications poll every 20 seconds while relevant screens are open; there are no background SMS or WhatsApp notifications. Existing typed form values are preserved when announcing an update.

Validation: `tests/subscriptions.sql` and `tests/preorder_flow.sql` run in rollback-only transactions. `tests/meal-ui.cjs` and `tests/admin-subscriptions.cjs` use jsdom with mock RPCs. No real payment was recorded. A real end-to-end browser order and actual Cash Plus receipt confirmation remain launch checks.
