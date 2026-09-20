# Current release verification

Use the latest feature branch and `PRODUCT_DECISIONS.md` for product behavior. Historical `preorder_flow`, `cook-to-order`, and original negotiated `customer-led.sql` scenarios describe older flows, not the current launch gate.

## Current checks

- `discovery-location.cjs`: no assumed customer city or GPS request; city filters, real-source distance labels, GPS refusal, point selection and refresh, published pins, stale marker clearing, network errors, owner consent gate and publication. Leaflet is a test double; backend visibility is checked separately.
- `kitchen-map-consent.sql`: one BEGIN/ROLLBACK call; private coordinates, explicit publication, revocation, removal and invalid sessions. Does not change a real kitchen location.
- `customer-cancellation.cjs`: cancellation removes customer tracking, preserves other requests and survives refresh/deep links; failed cancellation and unavailable networks never erase another request.

- `optional-request-time.sql`: one BEGIN/ROLLBACK call; omitted, empty and null appointment values remain NULL through acceptance/preparation, and an explicit appointment beyond sixty days remains intact. UI/navigation checks require no selected dish on entry or restore.

- `direct-contact.sql`: run **the whole file in one SQL call** after the consistency migration. BEGIN/ROLLBACK fixtures verify request idempotency, acceptance, phone agreement actor, preparation, ready/delivered, distinct receipt, rating gates, cancellation, overdue refusal, rescheduling old requests, capability isolation and private tables. No fixtures persist.
- `customer-led-ui.cjs`: actual application scripts in jsdom, with an in-memory RPC double. Checks dish entry, reference/custom requests, contact links, preparation/delivery/receipt/rating and saved receipts. It does not replace backend checks or a phone test.
- `navigation-state.cjs`: fresh DOM after refresh; public/private screens, form drafts and edited dish ID, previous screen, inert blank space, approved homepage stability, session denial, receipts and PIN exclusion.
- `request-admin.cjs`: current request follow-up and complaint controls, overdue/received classification, actor-specific agreement display.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run build
```

`npm test` runs eleven suites and fails on the first failing or timed-out suite. The build runs the same gate before writing `dist/`. Node.js 22+ and Python 3 are required; no test dependency is shipped to visitors.

Additional stabilization checks:

- `architecture.cjs`: parses both real page script lists, rejects duplicate global declarations/function replacements and multiple startups; includes deliberately broken examples to prove the guard fails.
- `order-rules.cjs`: shared optional time, revised deadlines, receipt, legacy expiry and integer/cent prices.
- `admin-ui.cjs`: loads all actual admin scripts; tab filtering, complaint handling, one request per startup, urgency deduplication, refresh failure and sign-out.
- `async-navigation.cjs`: a delayed response cannot reopen an abandoned page or replace the latest selected request; reminders cause no duplicate fetch.
- `admin-followup.cjs` and `admin-subscriptions.cjs`: historical order follow-up and free kitchen activation remain supported. The latter tests the absence of billing requirements.

The runtime test list comes from `index.html` / `admin.html`, via `scripts/runtime-scripts.cjs`, so code loading cannot silently diverge between tests and the website.


## Phone acceptance remains required

With an authorized test kitchen and customer, test request → accept → contact → agree/start preparation → ready → delivered → customer receipt → optional rating. Also test rejection, late request, reopening/refresh and admin complaint follow-up. No automatic messages are sent by these tests. Contact buttons open phone/WhatsApp; they do not initiate calls. Polling while visible is not background notification.

Static build and preview success are distinct from deployment to the user's Cloudflare URL. Record the tested commit and destination; never infer publication from a GitHub commit alone.

## Stabilization verification — 20 September 2026

- All eleven JavaScript/DOM/architecture suites passed on the refactored code.
- `direct-contact.sql`, `optional-request-time.sql` and `kitchen-map-consent.sql` passed against the linked Supabase project, each as one transaction with rollback. No production fixture records were retained and no schema was changed by this refactor.
- Public order creation now has one implementation. Tracking, navigation, dashboard and admin loading no longer replace earlier global functions.
- Actual publication and phone acceptance must still be recorded separately; the results above do not claim either.
