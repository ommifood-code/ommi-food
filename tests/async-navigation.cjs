const { JSDOM } = require("jsdom");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { root, runtimeScripts } = require("../scripts/runtime-scripts.cjs");
const w = new JSDOM(
  fs
    .readFileSync(path.join(root, "index.html"), "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, ""),
  { url: "https://test.invalid", runScripts: "dangerously" },
).window;
const pending = new Map(),
  errors = [],
  calls = [];
w.supabase = {
  createClient: () => ({
    rpc: (name, args) => {
      calls.push(name);
      if (name === "food_request_customer")
        return new Promise((resolve) => pending.set(args.p_token, resolve));
      return Promise.resolve({ data: [] });
    },
  }),
};
w.scrollTo = () => {};
w.confirm = () => true;
w.addEventListener("error", (event) => errors.push(event.error));
for (const file of runtimeScripts()) {
  const script = w.document.createElement("script");
  script.textContent = fs.readFileSync(path.join(root, file), "utf8");
  w.document.body.append(script);
}
const order = (name) => ({
  request_v2: true,
  status: "pending",
  dish_name: name,
  people: 1,
  requested_at: null,
  order_ref: "OF-test",
  last_reminder_at: "2030-01-01",
});
(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  const a = "a".repeat(64),
    b = "b".repeat(64);
  const abandoned = w.openCustomerMealOrder(a);
  w.showScreen("home");
  pending.get(a)({ data: order("قديم") });
  await abandoned;
  assert.equal(
    w.document.querySelector(".screen.active").id,
    "home",
    "late response cannot reopen a page after leaving",
  );
  assert.equal(w.document.getElementById("customerMealTracking"), null);
  const first = w.openCustomerMealOrder(a),
    second = w.openCustomerMealOrder(b);
  pending.get(b)({ data: order("الأحدث") });
  await second;
  pending.get(a)({ data: order("قديم") });
  await first;
  assert.match(
    w.document.querySelector("#customerMealTracking").textContent,
    /الأحدث/,
  );
  assert.doesNotMatch(
    w.document.querySelector("#customerMealTracking").textContent,
    /قديم/,
  );
  assert.equal(w.location.hash, "#order=" + b);
  assert.equal(
    calls.filter((name) => name === "food_request_customer").length,
    3,
    "one fetch per opening; no reminder wrapper refetch",
  );
  assert.equal(
    w.document.querySelectorAll("#customerMealTracking .pending-summary")
      .length,
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS delayed response cannot undo navigation or replace a newer order; reminders use the same response",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => w.close());
