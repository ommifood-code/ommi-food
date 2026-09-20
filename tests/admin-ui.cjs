const { JSDOM } = require("jsdom");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { root, runtimeScripts } = require("../scripts/runtime-scripts.cjs");
const w = new JSDOM(
  fs
    .readFileSync(path.join(root, "admin.html"), "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, ""),
  { url: "https://test.invalid/admin.html", runScripts: "dangerously" },
).window;
const past = new Date(Date.now() - 7200000).toISOString();
const requests = [
  {
    id: "late",
    request_v2: true,
    status: "pending",
    dish_name: "طلب متأخر",
    requested_at: past,
    complaint: "لم يرد المطبخ",
    created_at: past,
  },
  {
    id: "received",
    request_v2: true,
    status: "ready",
    dish_name: "طلب مستلم",
    requested_at: past,
    received_at: past,
    created_at: past,
  },
  {
    id: "optional",
    request_v2: true,
    status: "pending",
    dish_name: "موعد حسب الاتفاق",
    requested_at: null,
    created_at: past,
  },
];
const legacy = [
  {
    id: "legacy",
    chef_id: "chef",
    status: "pending",
    dish_name: "طلب سابق",
    order_until: past,
    complaint: "بلاغ قديم",
    created_at: past,
  },
];
const chef = {
  id: "chef",
  name: "اختبار",
  status: "active",
  membership_status: "active",
  membership_type: "honorary",
  dishes: [{ name: "طبق", price: 40 }],
};
const calls = [],
  errors = [];
let loggedIn = true,
  failRequests = false;
const query = (table) => ({
  select() {
    return this;
  },
  not() {
    return this;
  },
  is() {
    return this;
  },
  eq() {
    return this;
  },
  gt() {
    return this;
  },
  order() {
    return this;
  },
  limit: async () => ({ data: legacy }),
  in: async () => ({ data: [chef] }),
});
w.supabase = {
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: loggedIn
            ? { user: { email: "test@example.invalid" } }
            : null,
        },
      }),
      signOut: async () => {
        loggedIn = false;
      },
    },
    from: query,
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "admin_list_chefs") return { data: [chef] };
      if (name === "food_request_admin") {
        if (failRequests) return { error: { message: "offline" } };
        if (args?.p_action === "resolve")
          requests.find((row) => row.id === args.p_id).complaint_resolved_at =
            past;
        return { data: { requests, metrics: { requests: requests.length } } };
      }
      throw Error("Unexpected RPC " + name);
    },
  }),
};
w.addEventListener("error", (event) => errors.push(event.error));
for (const file of runtimeScripts("admin.html")) {
  const script = w.document.createElement("script");
  script.textContent = fs.readFileSync(path.join(root, file), "utf8");
  w.document.body.append(script);
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
const tab = (name) =>
  w.document.querySelector(`.admin-tab[data-admin-view="${name}"]`).click();
(async () => {
  await tick();
  assert.equal(
    calls.filter(([name]) => name === "food_request_admin").length,
    1,
    "one authorized startup request",
  );
  assert.equal(
    w.document.getElementById("urgentCount").textContent,
    "2",
    "one order with lateness and complaint counts once",
  );
  assert.equal(w.document.getElementById("complaintCount").textContent, "2");
  tab("complaints");
  assert.equal(
    w.document.querySelectorAll(".admin-request-card:not([hidden])").length,
    1,
  );
  assert.equal(w.document.getElementById("adminChefSection").hidden, true);
  const resolve = [
    ...w.document
      .querySelector(".admin-open-complaint")
      .querySelectorAll("button"),
  ].find((button) => button.textContent === "تمت مراجعة البلاغ");
  await resolve.onclick();
  assert.equal(w.document.getElementById("complaintCount").textContent, "1");
  assert.equal(
    w.document.querySelectorAll(".admin-request-card:not([hidden])").length,
    0,
    "selected tab reapplied after refresh",
  );
  assert.equal(
    requests[0].status,
    "pending",
    "complaint review cannot accept order",
  );
  tab("urgent");
  assert.equal(
    w.document.querySelectorAll(".admin-request-card:not([hidden])").length,
    1,
  );
  tab("kitchens");
  assert.equal(w.document.getElementById("adminChefSection").hidden, false);
  assert.equal(w.document.getElementById("adminRequestsSection").hidden, true);
  tab("stats");
  assert.equal(w.document.getElementById("adminStatsSection").hidden, false);
  assert.equal(w.document.querySelectorAll(".admin-stat").length, 8);
  tab("all");
  assert.equal(
    w.document.querySelectorAll(".admin-request-card:not([hidden])").length,
    3,
  );
  failRequests = true;
  await w.loadAdminOrders();
  assert.match(
    w.document.getElementById("requestAdmin").textContent,
    /تعذر تحميل/,
  );
  await w.document.getElementById("adminLogoutBtn").onclick();
  assert.equal(w.document.getElementById("adminDashboard").hidden, true);
  const before = calls.length;
  await w.verify();
  assert.equal(
    calls.length,
    before,
    "signed out administration does not load private data",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS real admin scripts: single startup, all tabs, unique urgency counts, complaint review, refresh errors and sign-out",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => w.close());
