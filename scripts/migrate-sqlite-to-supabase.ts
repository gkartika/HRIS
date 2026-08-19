// One-time data migration: copies every row from the local SQLite dev.db
// into the already-schema-migrated Supabase Postgres database. Column types
// are converted based on the ACTUAL destination Postgres column types
// (introspected live via information_schema), not guessed from the Prisma
// schema text, so it stays correct even if the schema drifts slightly from
// what's written on disk. FK/trigger checks are disabled for the session
// (session_replication_role = 'replica') so tables can be copied in any
// order despite the schema's circular references (e.g. Employee <->
// Position <-> Assignment) — re-enabled again at the end regardless of
// success or failure.
//
// Never logs actual row data (real employee PII) — only table names and
// row counts.
import Database from "better-sqlite3";
import { Client } from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

const SQLITE_PATH = path.resolve(__dirname, "../dev.db");

function toPgLiteralType(pgDataType: string): "boolean" | "timestamp" | "json" | "passthrough" {
  if (pgDataType === "boolean") return "boolean";
  if (pgDataType.startsWith("timestamp")) return "timestamp";
  if (pgDataType === "json" || pgDataType === "jsonb") return "json";
  return "passthrough";
}

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Client({ connectionString: process.env.DIRECT_URL });
  await pg.connect();

  try {
    await pg.query("SET session_replication_role = 'replica';");

    const tablesResult = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name != '_prisma_migrations'
       ORDER BY table_name;`
    );
    const tableNames = tablesResult.rows.map((r) => r.table_name);

    console.log(`Found ${tableNames.length} tables to copy.\n`);

    const summary: { table: string; sqliteRows: number; inserted: number; error?: string }[] = [];

    for (const table of tableNames) {
      const columnsResult = await pg.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position;`,
        [table]
      );
      const columns = columnsResult.rows;
      const columnTypes = new Map(columns.map((c) => [c.column_name, toPgLiteralType(c.data_type)]));

      let sqliteRows: unknown[];
      try {
        sqliteRows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      } catch (e) {
        summary.push({ table, sqliteRows: 0, inserted: 0, error: `SQLite read failed: ${(e as Error).message}` });
        continue;
      }

      if (sqliteRows.length === 0) {
        summary.push({ table, sqliteRows: 0, inserted: 0 });
        continue;
      }

      const columnNames = columns.map((c) => c.column_name);
      let inserted = 0;
      let error: string | undefined;

      await pg.query("BEGIN");
      try {
        for (const rawRow of sqliteRows) {
          const row = rawRow as Record<string, unknown>;
          const values = columnNames.map((col) => {
            const v = row[col];
            if (v === null || v === undefined) return null;
            const kind = columnTypes.get(col);
            if (kind === "boolean") return v === 1 || v === true;
            if (kind === "timestamp") return typeof v === "string" ? new Date(v) : v;
            if (kind === "json") return typeof v === "string" ? v : JSON.stringify(v);
            return v;
          });
          const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(", ");
          const quotedCols = columnNames.map((c) => `"${c}"`).join(", ");
          await pg.query(`INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`, values);
          inserted++;
        }
        await pg.query("COMMIT");
      } catch (e) {
        await pg.query("ROLLBACK");
        error = (e as Error).message;
      }

      summary.push({ table, sqliteRows: sqliteRows.length, inserted, error });
    }

    console.log("=== Migration summary ===");
    let anyError = false;
    for (const s of summary) {
      const status = s.error ? `FAILED: ${s.error}` : s.inserted === s.sqliteRows ? "OK" : "PARTIAL";
      if (s.error || s.inserted !== s.sqliteRows) anyError = true;
      console.log(`${s.table.padEnd(35)} sqlite=${s.sqliteRows}  inserted=${s.inserted}  ${status}`);
    }

    if (anyError) {
      console.log("\n⚠ One or more tables did not fully migrate — see FAILED/PARTIAL rows above.");
      process.exitCode = 1;
    } else {
      console.log("\n✓ All tables migrated successfully.");
    }
  } finally {
    await pg.query("SET session_replication_role = 'origin';");
    await pg.end();
    sqlite.close();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
