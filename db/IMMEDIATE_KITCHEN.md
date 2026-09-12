# Kitchen activation and order acceptance are separate

Approved product decision: during the free launch, a newly registered kitchen should activate automatically. Phone verification must not be fabricated. Account suspension remains available to administrators. Public discovery and booking must use consistent eligibility checks, with no paid subscription requirement during the free launch.

Customer orders remain pending until the chef accepts. Acceptance reserves portions atomically; cancellation releases previously allocated portions once. Do not convert existing pending orders to accepted as a migration side effect.

Status: the mixed immediate_kitchen_and_auto_confirm.sql was removed because it implemented an unintended order-confirmation change. The existing phone-publication trigger must be inspected before implementing kitchen-only activation. Database SQL access timed out twice on 2026-09-12 although the management API reports the project ACTIVE_HEALTHY. No kitchen-activation migration has been applied or verified in this repair. Do not claim immediate activation is live.
