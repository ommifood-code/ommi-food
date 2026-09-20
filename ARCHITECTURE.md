# Runtime ownership

Each loaded global has one declaration. A feature calls its owner directly; it must not capture an earlier implementation and replace it later. `scripts/check-runtime.cjs` parses both page manifests and rejects duplicate global declarations, function reassignment and competing startup handlers.

| Owner | Responsibility |
| --- | --- |
| `order-rules.js` | Immutable shared prices, dates, people labels, deadlines, receipt and lateness rules. Used by public and admin pages. |
| `app.js` | Supabase client, common UI, unsaved edit checks and one delegated back/home handler. |
| `dish-images.js` | Kitchen identity/session and secure image upload; legacy kitchen editor compatibility. |
| `meal-orders.js` | Order RPC helpers, receipt storage, explicit legacy order renderers and kitchen order loading. No new legacy order creation. |
| `food-requests.js` | Current request form, customer tracking and current kitchen actions. Explicit dispatch to legacy renderers only for old records. |
| `kitchen-overview.js` | Kitchen dashboard, dishes, incoming requests and publication status. |
| `simple-launch.js` | Current dish editor, kitchen settings, sharing and opening shared kitchen links. |
| `kitchen-settings.js` | Shared kitchen work days and fulfilment preferences. |
| `nearby.js` | Discovery, explicit location selection, consent and map markers. |
| `navigation-state.js` | One `showScreen`, one `navigateBack`, one navigation history and one startup/address restoration path. |
| `admin.js` | Admin authentication, kitchen management, tabs and attention counters. |
| `admin-orders.js` | One admin refresh coordinator; explicitly named historical order loader. |
| `food-request-admin.js` | Current request records, complaints and metrics. |

## State and compatibility

- Supabase RPCs authorize mutations and enforce transitions. Client rules never replace server authorization. Reference prices are not payment records.
- New requests are created only through `food_request_create`. Old `orders` records remain readable and manageable through explicitly named legacy renderers. They cannot override the current request form.
- Public pending expiry uses the requested deadline. Admin follow-up also identifies late accepted/preparing/ready requests using the revised agreed deadline. Both stop treating a received request as overdue. An omitted time is never a deadline.
- Navigation uses snapshots in one per-tab history. Kitchen context is assigned when its dashboard opens and revalidated before restoring a private screen. No PIN or image file is saved in navigation state.
- Customer cancellation removes its saved receipt and navigation references, not the server audit record. Offline failures must retain active receipts.
- Late tracking responses cannot change a page after navigation or overwrite a newer tracking response. Reminder content uses the same response as the order, not a second fetch.
- Home/back buttons are handled once by the delegated click handler. Individual screens do not install competing back actions. Clicking blank space is inert.
- `next/` and `meal-ux-hardening.js` are historical, unloaded code, excluded from the deployment allowlist. They are not extension points for the current application.

## Release gate

Run `npm ci`, then `npm run build`. Build runs all current suites before replacing output. GitHub Actions executes the same build. `tests/architecture.cjs` additionally proves that the guard rejects intentionally duplicated and overwritten functions.

Tests derive their runtime scripts from deployed HTML. Never make a test pass by loading a different script list from the application. Add a regression for a user-visible failure before considering it resolved. Database fixtures run with rollback and relevant anonymous authorization checks; never alter real requests to make a test pass.

Verify the real Cloudflare URL after publishing. Keep the approved homepage and product decisions stable during structural maintenance. A successful automated build does not establish phone/WhatsApp behavior on the user's handset or background notifications.
