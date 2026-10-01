import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
// LOCAL TEST ONLY. This loopback adapter has synthetic identities and no production credentials.
const db = new PGlite();
const users = ["alice", "bob"].map((name, i) => ({
  id: `10000000-0000-4000-8000-00000000000${i + 1}`,
  email: `${name}@example.com`,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
}));
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''email'',current_setting(''request.jwt.claim.email'',true))'; grant usage on schema auth to anon,authenticated;`,
);
for (const u of users)
  await db.query("insert into auth.users values($1)", [u.id]);
for (const file of ["0001_init.sql", "0002_workflow_integrity.sql"])
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
await db.exec(
  "grant select,insert,update,delete on all tables in schema public to anon,authenticated",
);
await db.exec(
  await readFile(
    new URL("../supabase/migrations/0003_team_workspaces.sql", import.meta.url),
    "utf8",
  ),
);
for (const file of [
  "0004_archive_team.sql",
  "0005_submission_checklist.sql",
  "0006_configurable_stamping_due.sql",
  "0007_rental_and_area.sql",
])
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
const tables = new Set([
  "properties",
  "units",
  "tenants",
  "tenancy_agreements",
  "outstanding_actions",
  "audit_logs",
  "teams",
  "team_members",
  "team_invites",
]);
const rpcs = new Set([
  "create_team",
  "invite_team_member",
  "accept_team_invite",
  "revoke_team_invite",
  "manage_team_member",
]);
const ident = (s) => {
  if (!/^[a-z_]+$/.test(s)) throw Error("Invalid identifier");
  return '"' + s + '"';
};
const jwt = (u) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: u.id,
        email: u.email,
        aud: "authenticated",
        role: "authenticated",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "local-test-only",
  ].join(".");
let queue = Promise.resolve();
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const work = async () => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:54322");
      const data = body ? JSON.parse(body) : {};
      let current;
      try {
        const claims = JSON.parse(
          Buffer.from(
            (req.headers.authorization ?? "").split(".")[1] ?? "",
            "base64url",
          ),
        );
        current = users.find((u) => u.id === claims.sub);
      } catch {}
      if (url.pathname.startsWith("/auth/v1/")) {
        if (url.pathname.endsWith("/token")) {
          const u = users.find((u) => u.email === data.email) || current;
          if (!u)
            throw Error(
              "Use alice@example.com or bob@example.com for the local test",
            );
          res.end(
            JSON.stringify({
              access_token: jwt(u),
              refresh_token: u.id,
              token_type: "bearer",
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              user: u,
            }),
          );
          return;
        }
        if (url.pathname.endsWith("/user")) {
          if (!current) throw Error("No test session");
          res.end(JSON.stringify(current));
          return;
        }
        if (url.pathname.endsWith("/logout")) {
          res.end("{}");
          return;
        }
        throw Error("Auth route unsupported in local fixture");
      }
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",
        [current?.id ?? "", current?.email ?? ""],
      );
      await db.exec("set role " + (current ? "authenticated" : "anon"));
      const table = url.pathname.split("/").pop();
      let sql = "",
        values = [],
        scalar = false;
      if (url.pathname.includes("/rpc/")) {
        if (!rpcs.has(table)) throw Error("Invalid RPC");
        values = Object.values(data);
        sql = `select ${ident(table)}(${Object.keys(data)
          .map((key, i) => ident(key) + " => $" + (i + 1))
          .join(",")}) as value`;
        scalar = true;
      } else {
        if (!tables.has(table)) throw Error("Invalid table");
        const filters = [];
        for (const [key, value] of url.searchParams) {
          if (["select", "order", "limit", "columns"].includes(key)) continue;
          if (value === "is.null") filters.push(ident(key) + " is null");
          else if (value.startsWith("eq.")) {
            values.push(value.slice(3));
            filters.push(ident(key) + "=$" + values.length);
          } else throw Error("Unsupported filter");
        }
        const where = filters.length ? " where " + filters.join(" and ") : "";
        if (req.method === "GET")
          sql = `select * from ${ident(table)}${where} order by created_at`;
        else if (req.method === "POST") {
          const rows = Array.isArray(data) ? data : [data];
          const keys = Object.keys(rows[0]);
          values = [];
          sql =
            `insert into ${ident(table)} (${keys.map(ident)}) values ` +
            rows
              .map(
                (row) =>
                  "(" +
                  keys
                    .map((key) => {
                      values.push(row[key]);
                      return "$" + values.length;
                    })
                    .join(",") +
                  ")",
              )
              .join(",") +
            " returning *";
        } else if (req.method === "PATCH") {
          const sets = Object.keys(data).map((key) => {
            values.push(data[key]);
            return ident(key) + "=$" + values.length;
          });
          sql = `update ${ident(table)} set ${sets.join(",")}${where} returning *`;
        } else if (req.method === "DELETE")
          sql = `delete from ${ident(table)}${where} returning *`;
        else throw Error("Unsupported method");
      }
      const result = await db.query(sql, values);
      for (const row of result.rows)
        for (const key of Object.keys(row))
          if (key.endsWith("_date") && row[key] instanceof Date)
            row[key] = row[key].toISOString().slice(0, 10);
      res.end(
        JSON.stringify(
          scalar
            ? result.rows[0].value
            : req.headers.accept?.includes("vnd.pgrst.object")
              ? result.rows[0]
              : result.rows,
        ),
      );
    } catch (error) {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          message: error.message,
          error_description: error.message,
        }),
      );
    }
  };
  queue = queue.then(work, work);
  await queue;
});
server.listen(Number(process.env.TEST_DB_PORT || 54322), "127.0.0.1", () =>
  console.log(
    "Private-team PostgreSQL fixture on 127.0.0.1:54322. Synthetic alice@example.com / bob@example.com; any test password.",
  ),
);
