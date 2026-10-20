import { limit } from "../../lib/limit";
import { db, auth, seal, unseal } from "../../lib/server";
import { cleanResearcher } from "../../lib/trialFields";

export default async function handler(req, res) {
  if (!(await limit(req, res, "researcher", 30))) return;
  const w = auth(req, res); if (!w) return;
  if (req.method === "GET") {
    const { rows } = await db.query("select data, verified from researchers where wallet=$1", [w]);
    return res.json({ profile: rows[0] ? unseal(rows[0].data) : null, verified: !!rows[0]?.verified });
  }
  if (req.method === "PUT") {
    const { p, error } = cleanResearcher(req.body);
    if (error) return res.status(400).json({ error });
    const old = (await db.query("select data from researchers where wallet=$1", [w])).rows[0];
    const o = old && unseal(old.data);
    const changed = !!o && (o.org !== p.org || o.email !== p.email); // changing org or email drops verification
    await db.query(
      `insert into researchers(wallet,data) values($1,$2)
       on conflict(wallet) do update set data=$2, updated_at=now(), verified = researchers.verified and not $3::boolean`,
      [w, seal(p), changed]);
    return res.json({ ok: true });
  }
  if (req.method === "DELETE") { await db.query("delete from researchers where wallet=$1", [w]); return res.json({ ok: true }); }
  res.status(405).end();
}
