// Shared disposable PostgreSQL fixture; keep the original browser-test port.
process.env.TEST_DB_PORT = "54321";
await import("./team-db.mjs");
