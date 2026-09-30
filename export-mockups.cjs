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
)
  .replace(
    'href="/"',
    'href="https://tenancy-agreement-tracker-app.vercel.app/"',
  )
  .replace(
    /src="\/properties\/([^\"]+)"/g,
    (_, file) =>
      `src="data:image/png;base64,${fs.readFileSync("public/properties/" + file).toString("base64")}"`,
  );
const css =
  fs.readFileSync("app/globals.css", "utf8").replace(/^@import[^;]*;/gm, "") +
  fs.readFileSync("app/candy.css", "utf8");
const html =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tenancy — Team workspace mockups</title><style>' +
  css +
  "</style></head><body>" +
  markup +
  "</body></html>";
fs.mkdirSync("../../outputs", { recursive: true });
fs.writeFileSync("../../outputs/team-workspace-mockups.html", html);
fs.mkdirSync("public/previews", { recursive: true });
fs.writeFileSync(
  "public/previews/team-workspace-mockups.html",
  html.replace(/src="data:image\/png;base64,([^"]+)"/g, (match, data) => {
    const file = fs
      .readdirSync("public/properties")
      .find(
        (file) =>
          fs.readFileSync("public/properties/" + file).toString("base64") ===
          data,
      );
    return file ? `src="/properties/${file}"` : match;
  }),
);
console.log("Created self-contained desktop and mobile mockups.");
