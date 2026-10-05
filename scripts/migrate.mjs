import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running migrations.");
const sql = neon(process.env.DATABASE_URL);
await sql.query("CREATE TABLE IF NOT EXISTS scope_log_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
const applied = new Map((await sql.query("SELECT name, hash FROM scope_log_migrations")).map(row => [row.name, row.hash]));
for (const name of (await readdir(new URL("../drizzle/", import.meta.url))).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
  const source = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  const hash = createHash("sha256").update(source.replace(/\r\n/g, "\n")).digest("hex");
  if (applied.has(name)) { if (applied.get(name) !== hash) throw new Error(`Applied migration changed: ${name}`); continue; }
  // These SQL files contain only plain DDL/DML, without semicolons in string literals.
  const statements = source.split(";").map(s => s.trim()).filter(Boolean);
  await sql.transaction([...statements.map(s => sql.query(s)), sql.query("INSERT INTO scope_log_migrations (name, hash) VALUES ($1, $2)", [name, hash])]);
  console.log(`Applied ${name}`);
}
console.log("Database is up to date.");
