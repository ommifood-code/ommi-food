# Current release verification

Use the latest feature branch and `PRODUCT_DECISIONS.md` for product behavior. Historical `preorder_flow`, `cook-to-order`, and original negotiated `customer-led.sql` scenarios describe older flows, not the current launch gate.

## Current checks

- `optional-request-time.sql`: one BEGIN/ROLLBACK call; omitted, empty and null appointment values remain NULL through acceptance/preparation, and an explicit appointment beyond sixty days remains intact. UI/navigation checks require no selected dish on entry or restore.

- `direct-contact.sql`: run **the whole file in one SQL call** after the consistency migration. BEGIN/ROLLBACK fixtures verify request idempotency, acceptance, phone agreement actor, preparation, ready/delivered, distinct receipt, rating gates, cancellation, overdue refusal, rescheduling old requests, capability isolation and private tables. No fixtures persist.
- `customer-led-ui.cjs`: actual application scripts in jsdom, with an in-memory RPC double. Checks dish entry, reference/custom requests, contact links, preparation/delivery/receipt/rating and saved receipts. It does not replace backend checks or a phone test.
- `navigation-state.cjs`: fresh DOM after refresh; public/private screens, form drafts and edited dish ID, previous screen, inert blank space, approved homepage stability, session denial, receipts and PIN exclusion.
- `request-admin.cjs`: current request follow-up and complaint controls, overdue/received classification, actor-specific agreement display.

```sh
npm install --prefix /tmp/ommi-tests --no-audit --no-fund jsdom@26.1.0
NODE_PATH=/tmp/ommi-tests/node_modules node tests/customer-led-ui.cjs
NODE_PATH=/tmp/ommi-tests/node_modules node tests/navigation-state.cjs
NODE_PATH=/tmp/ommi-tests/node_modules node tests/request-admin.cjs
python scripts/build-static.py
```

## Phone acceptance remains required

With an authorized test kitchen and customer, test request → accept → contact → agree/start preparation → ready → delivered → customer receipt → optional rating. Also test rejection, late request, reopening/refresh and admin complaint follow-up. No automatic messages are sent by these tests. Contact buttons open phone/WhatsApp; they do not initiate calls. Polling while visible is not background notification.

Static build and preview success are distinct from deployment to the user's Cloudflare URL. Record the tested commit and destination; never infer publication from a GitHub commit alone.
