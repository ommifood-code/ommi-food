# Scheduled meal verification

`preorder_flow.sql` runs against the deployed schema as postgres, inside one transaction ending in ROLLBACK. It creates only transaction-local fixtures and checks server-side totals, idempotency, cross-chef denial, private customer capability, capacity, transitions, cancellation, delivery validation, feedback and expiry. Never split this script into separate SQL requests.

`meal-ui.cjs` runs the actual HTML and three application scripts in jsdom with an in-memory RPC double. It does not contact Supabase. Install jsdom 26.1.0 in a temporary test directory, then run:

```sh
npm install --prefix /tmp/ommi-dom-check --no-audit --no-fund jsdom@26.1.0
NODE_PATH=/tmp/ommi-dom-check/node_modules node tests/meal-ui.cjs
```

The DOM test checks dashboard actions, scheduling, Morocco timezone conversion, conditional delivery fields, displayed totals, order submission, receipt persistence and kitchen-save navigation. It is not a visual browser or real customer E2E test.

## Deployment

Database migrations applied: `scheduled_meals_private_order_flow`, then `meal_offers_respect_public_chef_column_grants`. `db/preorder_flow.sql` contains the consolidated equivalent for a fresh baseline; do not re-run it on the already migrated production database.

Frontend requires these migrations. Existing registration and kitchen-save RPC signatures are unchanged. Old direct `orders` access is revoked: no public customer data or arbitrary order insertion. Frontend and database pricing come from the offer snapshot, not the customer.

## Acceptance before public launch

Use one authorized test kitchen and customer: schedule a meal, place request, accept, prepare, mark ready, deliver, confirm receipt and submit/resolve a complaint. Test on mobile. No SMS, payment service, subscription, driver dispatch or automatic notifications are enabled. Both parties refresh their order lists manually. Phone-based request throttling is basic and is not IP/device abuse protection. Pending requests do not reserve capacity; only acceptance does. Chef publication verification remains mandatory.

Current cook-to-order model: run cook-to-order.sql and meal-ui.cjs. Previous SQL fixtures have been adapted to customer-chosen times; stock assertions are removed. No live fixtures persist.
