const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const walk = require("acorn-walk");
const { root, runtimeScripts } = require("./runtime-scripts.cjs");

function names(pattern) {
  if (!pattern) return [];
  if (pattern.type === "Identifier") return [pattern.name];
  if (pattern.type === "ObjectPattern")
    return pattern.properties.flatMap((p) => names(p.value || p.argument));
  if (pattern.type === "ArrayPattern") return pattern.elements.flatMap(names);
  return names(pattern.left || pattern.argument);
}

function checkSources(sources) {
  const owners = new Map(),
    functions = new Set(),
    errors = [],
    trees = [];
  for (const [file, source] of sources) {
    const tree = acorn.parse(source, {
      ecmaVersion: "latest",
      locations: true,
    });
    trees.push([file, tree]);
    for (const node of tree.body) {
      const bindings =
        node.type === "FunctionDeclaration" || node.type === "ClassDeclaration"
          ? [{ id: node.id, init: node }]
          : node.type === "VariableDeclaration"
            ? node.declarations
            : [];
      for (const binding of bindings)
        for (const name of names(binding.id)) {
          if (owners.has(name))
            errors.push(
              `${file}:${node.loc.start.line}: duplicate global ${name}; owner ${owners.get(name)}`,
            );
          owners.set(name, file);
          if (
            [
              "FunctionDeclaration",
              "FunctionExpression",
              "ArrowFunctionExpression",
            ].includes(binding.init?.type)
          )
            functions.add(name);
        }
    }
  }
  let startups = 0;
  for (const [file, tree] of trees)
    walk.simple(tree, {
      AssignmentExpression(node) {
        const left = node.left;
        const global =
          left.type === "Identifier"
            ? left.name
            : left.type === "MemberExpression" &&
                ["window", "globalThis"].includes(left.object.name)
              ? left.computed
                ? left.property.value
                : left.property.name
              : null;
        if (
          global &&
          (functions.has(global) || /FunctionExpression$/.test(node.right.type))
        ) {
          errors.push(
            `${file}:${node.loc.start.line}: replacing global function ${global} is forbidden`,
          );
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.name === "addEventListener" &&
          node.arguments[0]?.value === "DOMContentLoaded"
        )
          startups++;
      },
    });
  if (startups !== 1)
    errors.push(`Expected one startup handler, found ${startups}`);
  return { errors, globals: owners.size };
}

function checkRuntime() {
  let globals = 0;
  for (const page of ["index.html", "admin.html"]) {
    const scripts = runtimeScripts(page);
    if (new Set(scripts).size !== scripts.length)
      throw Error(`${page}: duplicate script inclusion`);
    const result = checkSources(
      scripts.map((file) => [
        file,
        fs.readFileSync(path.join(root, file), "utf8"),
      ]),
    );
    if (result.errors.length)
      throw Error(`${page}\n${result.errors.join("\n")}`);
    globals += result.globals;
  }
  console.log(
    `PASS runtime ownership: ${globals} bindings checked, no duplicate definitions or function replacements, one startup per page`,
  );
}
if (require.main === module) checkRuntime();
module.exports = { checkRuntime, checkSources };
