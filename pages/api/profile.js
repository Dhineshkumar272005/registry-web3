import { limit } from "../../lib/limit";
import { db, auth, seal, unseal } from "../../lib/server";
import { clean } from "../../lib/profileFields";

export default async function handler(req, res) {
  if (!(await limit(req, res, "profile", 30))) return;
  const w = auth(req, res); if (!w) return;
  if (req.method === "GET") {
    const { rows } = await db.query("select data from users where wallet=$1", [w]);
    return res.json({ profile: rows[0] ? unseal(rows[0].data) : null });
  }
  if (req.method === "PUT") {
    const { p, error } = clean(req.body);
    if (error) return res.status(400).json({ error });
    await db.query(
      `insert into users(wallet,data) values($1,$2)
       on conflict(wallet) do update set data=$2, updated_at=now()`, [w, seal(p)]);
    return res.json({ ok: true });
  }
  if (req.method === "DELETE") { // right to erasure: the profile row is actually removed
    await db.query("delete from users where wallet=$1", [w]);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
