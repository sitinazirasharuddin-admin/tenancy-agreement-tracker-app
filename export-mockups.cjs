const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = fs.readFileSync("app/mockups/page.tsx", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
}).outputText;
const component = { exports: {} };
new Function("require", "module", "exports", js)(
  require,
  component,
  component.exports,
);
const markup = renderToStaticMarkup(
  React.createElement(component.exports.default),
).replace(
  'href="/"',
  'href="https://tenancy-agreement-tracker-app.vercel.app/"',
);
const css = fs
  .readFileSync("app/globals.css", "utf8")
  .replace(/^@import[^;]*;/gm, "");
const html =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tenancy — Team workspace mockups</title><style>' +
  css +
  "</style></head><body>" +
  markup +
  "</body></html>";
fs.mkdirSync("../../outputs", { recursive: true });
fs.writeFileSync("../../outputs/team-workspace-mockups.html", html);
fs.mkdirSync("public/previews", { recursive: true });
fs.writeFileSync("public/previews/team-workspace-mockups.html", html);
console.log("Created self-contained desktop and mobile mockups.");
