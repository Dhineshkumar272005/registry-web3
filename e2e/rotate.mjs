// Key rotation check. DESTRUCTIVE: empties the users and researchers tables, so use a scratch database only.
//   ALLOW_DESTRUCTIVE_TEST=true DATABASE_URL=... node e2e/rotate.mjs
import crypto from "crypto";
import pg from "pg";
import { createRequire } from "module";
const { ring, seal, unseal, rotate } = createRequire(import.meta.url)("../scripts/rotate-keys.js");
if (process.env.ALLOW_DESTRUCTIVE_TEST !== "true") { console.error("Refusing to run: set ALLOW_DESTRUCTIVE_TEST=true on a scratch database."); process.exit(1); }
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n); };
const k1 = crypto.randomBytes(32).toString("hex"), k2 = crypto.randomBytes(32).toString("hex");
const oldR = ring(`1:${k1}`), both = ring(`2:${k2},1:${k1}`), only2 = ring(`2:${k2}`);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
await db.query("truncate users, researchers");
const rows = Array.from({ length: 1200 }, (_, i) => ({ wallet: "0x" + i.toString(16).padStart(40, "0"), p: { name: "Patient " + i, contact: `p${i}@example.org` } }));
for (let i = 0; i < rows.length; i += 400) {
  const part = rows.slice(i, i + 400);
  await db.query("insert into users(wallet,data) select * from unnest($1::text[], $2::bytea[])", [part.map((r) => r.wallet), part.map((r) => seal(r.p, oldR))]);
}
await db.query("insert into researchers(wallet,data) values($1,$2)", ["0x" + "ab".repeat(20), seal({ name: "Dr Test", org: "Example" }, oldR)]);
ok("records start under key 1", (await db.query("select count(*)::int n from users where get_byte(data,0)=1")).rows[0].n === 1200);
ok("a dry run counts but changes nothing", (await rotate(db, both, true)) === 1201 && (await db.query("select count(*)::int n from users where get_byte(data,0)=1")).rows[0].n === 1200);
ok("rotation re-encrypts every record, across several batches", (await rotate(db, both, false)) === 1201);
ok("all records now use key 2", (await db.query("select count(*)::int n from users where get_byte(data,0)<>2")).rows[0].n === 0 && (await db.query("select count(*)::int n from researchers where get_byte(data,0)<>2")).rows[0].n === 0);
const sample = (await db.query("select data from users where wallet=$1", [rows[777].wallet])).rows[0].data;
ok("contents survive rotation intact", JSON.stringify(unseal(sample, only2)) === JSON.stringify(rows[777].p));
let blocked = false; try { unseal(sample, oldR); } catch { blocked = true; }
ok("the old key alone can no longer read rotated records", blocked);
ok("a second rotation finds nothing left to do", (await rotate(db, both, false)) === 0);
await db.query("truncate users, researchers"); await db.end();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
