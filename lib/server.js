import { Pool } from "pg";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// Total connections = replicas x DB_POOL_MAX. Keep that below the database limit, or put a pooler (PgBouncer, transaction mode) in front.
export const db = globalThis.__pool || (globalThis.__pool = (() => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, statement_timeout: 10000,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });
  pool.on("error", (e) => console.error("database pool error:", e.message));
  return pool;
})());

// Field-level encryption with a key ring, so keys can be rotated without downtime.
// DATA_KEYS="2:<64 hex>,1:<64 hex>": the first entry encrypts new records, the others can still decrypt old ones.
// (DATA_KEY=<64 hex> alone is treated as key 1.) Each record starts with the id of the key that sealed it.
function keyring() {
  const spec = process.env.DATA_KEYS || (process.env.DATA_KEY ? `1:${process.env.DATA_KEY}` : "");
  const ring = new Map(); let active = null;
  for (const part of spec.split(",").filter(Boolean)) {
    const [id, hex] = part.split(":");
    ring.set(Number(id), Buffer.from(hex, "hex"));
    if (active === null) active = Number(id);
  }
  return { ring, active };
}
export function seal(obj) {
  const { ring, active } = keyring();
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", ring.get(active), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return Buffer.concat([Buffer.from([active]), iv, c.getAuthTag(), ct]);
}
export function unseal(buf) {
  const key = keyring().ring.get(buf[0]);
  if (!key) throw new Error("No key available for this record");
  const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(1, 13));
  d.setAuthTag(buf.subarray(13, 29));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(29)), d.final()]).toString());
}

export const loginMessage = (n) => `Sign in to Rare Trial Registry\nNonce: ${n}`;
export function setSession(res, wallet) {
  const t = jwt.sign({ w: wallet.toLowerCase() }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.setHeader("Set-Cookie", `session=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`);
}
export const adminWallets = () => (process.env.ADMIN_WALLETS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
export function auth(req, res) {
  const o = req.headers.origin; // refuse browser requests that come from another site
  if (o && req.method !== "GET" && req.method !== "HEAD") {
    let same = false; try { same = new URL(o).host === req.headers.host; } catch {}
    if (!same) { res.status(403).json({ error: "Cross-site request refused." }); return null; }
  }
  const m = /(?:^|; )session=([^;]+)/.exec(req.headers.cookie || "");
  try { return jwt.verify(m[1], process.env.JWT_SECRET).w; }
  catch { res.status(401).json({ error: "Sign in with your wallet first." }); return null; }
}
export function clearSession(res) {
  res.setHeader("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
}
