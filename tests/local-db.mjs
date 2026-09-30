import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
// Test-only PostgREST-shaped adapter over real PostgreSQL. Never used by the app in deployment.
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';`,
);
for (const file of ["0001_init.sql", "0002_workflow_integrity.sql"])
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
const tables = new Set([
  "tenancy_agreements",
  "properties",
  "units",
  "tenants",
  "outstanding_actions",
]);
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, "http://localhost:54321");
    const table = url.pathname.split("/").pop();
    if (!tables.has(table)) {
      res.writeHead(404);
      res.end("{}");
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    const values = [];
    const ident = (value) => {
      if (!/^[a-z_]+$/.test(value)) throw Error("Invalid column");
      return `"${value}"`;
    };
    let sql = "";
    const keys = Object.keys(data);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (req.method === "GET")
      sql = `select * from ${table} order by created_at desc`;
    else if (req.method === "POST") {
      values.push(...Object.values(data));
      sql = `insert into ${table} (${keys.map(ident).join(",")}) values (${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning *`;
    } else if (req.method === "PATCH") {
      values.push(...Object.values(data), id);
      sql = `update ${table} set ${keys.map((k, i) => `${ident(k)}=$${i + 1}`).join(",")} where id=$${values.length} returning *`;
    } else if (req.method === "DELETE") {
      values.push(id);
      sql = `delete from ${table} where id=$1 returning *`;
    } else throw Error("Unsupported method");
    const result = await db.query(sql, values);
    for (const row of result.rows)
      for (const key of Object.keys(row))
        if (key.endsWith("_date") && row[key] instanceof Date)
          row[key] = row[key].toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        req.headers.accept?.includes("vnd.pgrst.object")
          ? result.rows[0]
          : result.rows,
      ),
    );
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: error.message }));
  }
});
server.listen(54321, "127.0.0.1", () =>
  console.log("Local PostgreSQL test adapter ready on 54321"),
);
