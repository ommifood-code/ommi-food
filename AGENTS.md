# Ommi Food maintenance

- Read `PRODUCT_DECISIONS.md`, `ARCHITECTURE.md` and `tests/README.md` before changing runtime behavior.
- Preserve the approved homepage and current product decisions. User examples explain ideas; do not turn them into extra requirements, categories or sample data.
- Edit the owning implementation. Do not redefine, reassign or wrap a loaded global function to patch behavior. Do not introduce a second navigation history, startup handler or back-button implementation.
- Current requests use `food_request_create`; historical order support must stay explicitly named and must not create new orders under old rules.
- Tests must load the actual scripts listed in the page HTML. Run `npm run build`; it includes the release checks. Do not bypass the checks to publish.
- Schema or RPC changes require a migration and transactional regression tests. Keep anonymous/session authorization and rollback. Never modify real customer requests or kitchen coordinates for tests.
- The actual customer URL is `https://ommi-food.pages.dev/`. Verify the published application there. A preview URL or successful GitHub commit is not proof of publication.
- Report automated/browser/database checks separately from a real two-party phone acceptance test. Do not claim background notifications or paid memberships exist in the free launch.
