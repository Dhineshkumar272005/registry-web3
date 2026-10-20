import { limit, limitMem } from "../../lib/limit";
import { readOnly } from "../../lib/chain";
import { db, auth } from "../../lib/server";
import { cleanTrial } from "../../lib/trialFields";
import { maybeSync } from "../../lib/indexer";

export default async function handler(req, res) {
  if (req.method === "GET") { // public; ?ids=1,2,3 (up to 50), otherwise the 50 newest
    if (!limitMem(req, res, "trialmeta", 120)) return;
    const ids = String(req.query.ids || "").split(",").filter((x) => /^\d+$/.test(x)).slice(0, 50).map(Number);
    const { rows } = await db.query(
      `select m.trial_id, m.data, coalesce(r.verified,false) as verified
       from trial_meta m left join researchers r on r.wallet = m.researcher
       ${ids.length ? "where m.trial_id = any($1)" : ""} order by m.trial_id desc limit 50`, ids.length ? [ids] : []);
    const trials = {};
    for (const r of rows) trials[r.trial_id] = { ...r.data, verified: r.verified };
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate, s-maxage=20");
    return res.json({ trials });
  }
  if (req.method === "POST") { // create or update details, owner only
    if (!(await limit(req, res, "trialmeta", 60))) return;
    const me = auth(req, res); if (!me) return;
    const id = Number(req.body?.trialId);
    const t = await readOnly().getTrial(id).catch(() => null);
    if (!t || t.researcher.toLowerCase() !== me) return res.status(403).json({ error: "Not your trial." });
    if (!(await db.query("select 1 from researchers where wallet=$1", [me])).rows[0])
      return res.status(400).json({ error: "Save your researcher profile first." });
    const { p, error } = cleanTrial(req.body);
    if (error) return res.status(400).json({ error });
    await db.query(
      `insert into trial_meta(trial_id,researcher,data) values($1,$2,$3)
       on conflict(trial_id) do update set data=$3, updated_at=now()`, [id, me, p]);
    maybeSync(0);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
