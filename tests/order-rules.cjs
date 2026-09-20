const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const rules = vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "../order-rules.js"), "utf8") +
    "\nOrderRules;",
);
const now = Date.now(),
  past = new Date(now - 60000).toISOString(),
  future = new Date(now + 60000).toISOString();
assert.ok(Object.isFrozen(rules) && Object.isFrozen(rules.labels));
for (const requested_at of [null, undefined, "", "invalid"]) {
  const order = { request_v2: true, status: "pending", requested_at };
  assert.equal(rules.isOverdue(order, now), false);
  assert.equal(rules.effectiveStatus(order, now), "pending");
}
assert.equal(
  rules.effectiveStatus(
    { request_v2: true, status: "pending", requested_at: past },
    now,
  ),
  "expired",
);
assert.equal(
  rules.effectiveStatus({ status: "pending", order_until: past }, now),
  "expired",
);
assert.equal(
  rules.isOverdue(
    { status: "preparing", requested_at: past, agreed_at: future },
    now,
  ),
  false,
);
assert.equal(
  rules.isOverdue({ status: "preparing", requested_at: past }, now),
  true,
);
for (const status of ["delivered", "cancelled", "rejected"])
  assert.equal(rules.isOverdue({ status, requested_at: past }, now), false);
assert.equal(
  rules.isOverdue(
    { status: "ready", requested_at: past, received_at: past },
    now,
  ),
  false,
);
assert.equal(
  rules.statusLabel({ status: "ready", received_at: past }),
  "الاستلام مؤكد من الزبون",
);
assert.equal(rules.money(null), "غير محدد");
assert.equal(rules.money(0), "0 درهمًا");
assert.equal(rules.money(40), "40 درهمًا");
assert.equal(rules.money(3), "3 دراهم");
assert.equal(rules.money(40.5), "40 درهمًا و50 سنتيمًا");
assert.equal(rules.date(null), "حسب الاتفاق");
console.log(
  "PASS shared rules: optional time, expiry, revised appointment, receipt, legacy deadlines and simple prices",
);
