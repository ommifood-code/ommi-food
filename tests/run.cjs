const { spawnSync } = require("node:child_process");
const path = require("node:path");
const suites = [
  "architecture",
  "order-rules",
  "customer-led-ui",
  "navigation-state",
  "customer-cancellation",
  "discovery-location",
  "request-admin",
  "admin-followup",
  "admin-subscriptions",
  "admin-ui",
  "async-navigation",
];
for (const suite of suites) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, suite + ".cjs")],
    { stdio: "inherit", timeout: 30000 },
  );
  if (result.error || result.status !== 0) {
    console.error(
      `FAIL ${suite}: ${result.error?.message || "test did not pass"}`,
    );
    process.exit(1);
  }
}
console.log(`PASS all ${suites.length} release suites`);
