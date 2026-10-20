import { limitMem } from "../../lib/limit";
import { db } from "../../lib/server";
import { maybeSync } from "../../lib/indexer";

// Totals and filter options change slowly, so they are cached for 30 seconds per process.
let cache = { at: 0, v: null };
async function summary() {
  if (cache.v && Date.now() - cache.at < 30000) return cache.v;
  const [t, p, c] = await Promise.all([
    db.query("select coalesce(max(id) + 1, 0)::int as n from trials"),
    db.query("select count(*)::int as n from patients"),
    db.query("select distinct data->>'conditions' as c from trial_meta where coalesce(data->>'conditions','') <> '' limit 30")]);
  cache = { at: Date.now(), v: { stats: { trials: t.rows[0].n, patients: p.rows[0].n }, conditions: c.rows.map((r) => r.c).sort() } };
  return cache.v;
}

// Public, paginated, cacheable list of trials. Cursor paging keeps deep pages as fast as the first.
export default async function handler(req, res) {
  if (!limitMem(req, res, "trials", 120)) return;
  if (req.method !== "GET") return res.status(405).end();
  maybeSync();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const where = [], v = [];
  const researcher = String(req.query.researcher || "").toLowerCase();
  if (/^0x[0-9a-f]{40}$/.test(researcher)) { v.push(researcher); where.push(`t.researcher = $${v.length}`); } else where.push("t.open");
  if (/^\d+$/.test(String(req.query.cursor ?? ""))) { v.push(Number(req.query.cursor)); where.push(`t.id < $${v.length}`); }
  if (req.query.q) { v.push(String(req.query.q).slice(0, 100)); where.push(`to_tsvector('simple', t.title) @@ plainto_tsquery('simple', $${v.length})`); }
  if (req.query.condition) { v.push(String(req.query.condition).slice(0, 100)); where.push(`m.data->>'conditions' = $${v.length}`); }
  v.push(limit + 1);
  const { rows } = await db.query(
    `select t.id, t.researcher, t.title, t.criteria, t.consents, t.open, m.data as meta, coalesce(r.verified,false) as verified
     from trials t left join trial_meta m on m.trial_id = t.id left join researchers r on r.wallet = m.researcher
     where ${where.join(" and ")} order by t.id desc limit $${v.length}`, v);
  const page = rows.slice(0, limit);
  res.setHeader("Cache-Control", researcher ? "no-store" : "public, max-age=0, must-revalidate, s-maxage=15");
  res.json({
    trials: page.map((r) => ({ id: r.id, researcher: r.researcher, title: r.title, criteria: r.criteria, consents: r.consents, open: r.open, meta: r.meta ? { ...r.meta, verified: r.verified } : null })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    ...(await summary()),
  });
}
