const assert = require("node:assert/strict");
const { checkRuntime, checkSources } = require("../scripts/check-runtime.cjs");
checkRuntime();
const startup = "window.addEventListener('DOMContentLoaded',()=>{});";
assert.ok(
  checkSources([
    ["a.js", "function showScreen(){}" + startup],
    ["b.js", "function showScreen(){}"],
  ]).errors.some((e) => e.includes("duplicate global showScreen")),
);
assert.ok(
  checkSources([
    ["a.js", "function showScreen(){}" + startup],
    ["b.js", "showScreen=function(){};"],
  ]).errors.some((e) => e.includes("replacing global function showScreen")),
);
assert.ok(
  checkSources([
    ["a.js", "function showScreen(){}" + startup],
    ["b.js", "window.showScreen=()=>{};"],
  ]).errors.some((e) => e.includes("replacing global function showScreen")),
);
assert.ok(
  checkSources([
    ["a.js", startup],
    ["b.js", startup],
  ]).errors.some((e) => e.includes("startup")),
);
console.log(
  "PASS guard rejects duplicate functions, replacement wrappers, window overrides and competing startups",
);
