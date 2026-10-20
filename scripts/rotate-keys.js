// Re-encrypts every stored record under the active key.
//   1. Add the new key FIRST in DATA_KEYS, keeping the old one:  DATA_KEYS="2:<new 64 hex>,1:<old 64 hex>"
//   2. Deploy so every replica can read both keys.
//   3. node scripts/rotate-keys.js [--dry-run]
//   4. When it reports 0 records left, drop the old key from DATA_KEYS and deploy again.
const crypto = require("crypto");
function ring(spec) {
  const m = new Map(); let active = null;
  for (const part of (spec || "").split(",").filter(Boolean)) { const [id, hex] = part.split(":"); m.set(Number(id), Buffer.from(hex, "hex")); if (active === null) active = Number(id); }
  return { ring: m, active };
}
function seal(obj, r) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", r.ring.get(r.active), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return Buffer.concat([Buffer.from([r.active]), iv, c.getAuthTag(), ct]);
}
function unseal(buf, r) {
  const key = r.ring.get(buf[0]); if (!key) throw new Error(`No key ${buf[0]} in DATA_KEYS`);
  const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(1, 13)); d.setAuthTag(buf.subarray(13, 29));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(29)), d.final()]).toString());
}
async function rotate(client, r, dry) {
  let total = 0;
  for (const table of ["users", "researchers"]) {
    if (dry) { total += (await client.query(`select count(*)::int n from ${table} where get_byte(data, 0) <> $1`, [r.active])).rows[0].n; continue; }
    for (;;) {
      const { rows } = await client.query(`select wallet, data from ${table} where get_byte(data, 0) <> $1 order by wallet limit 500`, [r.active]);
      if (!rows.length) break;
      await client.query("begin");
      try { for (const row of rows) await client.query(`update ${table} set data=$2 where wallet=$1`, [row.wallet, seal(unseal(row.data, r), r)]); await client.query("commit"); }
      catch (e) { await client.query("rollback"); throw e; }
      total += rows.length;
    }
  }
  return total;
}
module.exports = { ring, seal, unseal, rotate };
if (require.main === module) (async () => {
  const { Client } = require("pg");
  const r = ring(process.env.DATA_KEYS || (process.env.DATA_KEY ? `1:${process.env.DATA_KEY}` : ""));
  if (r.active === null) { console.error("Set DATA_KEYS (newest key first)."); process.exit(1); }
  const dry = process.argv.includes("--dry-run");
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } });
  await client.connect();
  const n = await rotate(client, r, dry);
  console.log(dry ? `${n} record(s) would be re-encrypted under key ${r.active}.` : `Re-encrypted ${n} record(s) under key ${r.active}.`);
  await client.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
