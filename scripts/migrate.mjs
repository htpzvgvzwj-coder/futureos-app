import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(here, "migrate.sql"), "utf8");

const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL (or DATABASE_URL_UNPOOLED) in the environment.");
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log("Migration applied.");
} finally {
  await client.end();
}
