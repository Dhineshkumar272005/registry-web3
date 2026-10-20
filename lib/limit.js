import { db } from "./server";

// Behind a load balancer the real client is the Nth address from the right of X-Forwarded-For.
// Without TRUST_PROXY_HOPS the header is ignored, so clients cannot spoof their way past the limits.
export function clientIp(req) {
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (hops > 0) {
    const ips = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length >= hops) return ips[ips.length - hops];
  }
  return req.socket.remoteAddress || "?";
}
const off = () => process.env.RATE_LIMIT_DISABLED === "true"; // load testing only; the release gate forbids it in production
const reject = (res, secs) => { res.setHeader("Retry-After", String(secs)); res.status(429).json({ error: "Too many requests. Please wait a minute and try again." }); return false; };

// Shared across all replicas through the database. Use for sign-in and routes that touch personal data.
export async function limit(req, res, bucket, max, secs = 60) {
  if (off()) return true;
  const win = Math.floor(Date.now() / (secs * 1000));
  const { rows } = await db.query(
    `insert into rate_limits(k,win,n) values($1,$2,1)
     on conflict(k,win) do update set n=rate_limits.n+1 returning n`, [`${bucket}:${clientIp(req)}`, win]);
  return rows[0].n > max ? reject(res, secs) : true;
}

// Per process, no database write. Use for cheap public reads, backed by cache and edge limits.
const mem = globalThis.__rl || (globalThis.__rl = new Map());
export function limitMem(req, res, bucket, max, secs = 60) {
  if (off()) return true;
  const k = `${bucket}:${clientIp(req)}`, now = Date.now();
  let e = mem.get(k);
  if (!e || now > e.reset) { e = { n: 0, reset: now + secs * 1000 }; mem.set(k, e); }
  if (mem.size > 50000) for (const [kk, v] of mem) if (now > v.reset) mem.delete(kk);
  return ++e.n > max ? reject(res, secs) : true;
}
