const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

// Use the deployed HTML as the manifest. Tests must execute the same scripts in
// the same order as customers, rather than maintaining another hand-written list.
function runtimeScripts(page = "index.html") {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
    .map((match) => match[1])
    .filter((src) => !/^https?:\/\//.test(src))
    .map((src) => src.split("?")[0]);
}
module.exports = { root, runtimeScripts };
