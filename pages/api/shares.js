import { limit } from "../../lib/limit";
import { readOnly } from "../../lib/chain";
import { db, auth } from "../../lib/server";
import { syncOnce } from "../../lib/indexer";
import { cleanSections } from "../../lib/profileFields";

// The patient decides which profile sections each trial may see. Name and contact are always included.
export default async function handler(req, res) {
  if (!(await limit(req, res, "shares", 30))) return;
  const me = auth(req, res); if (!me) return;
  if (req.method === "GET") { // my consents and what each one shares
    await syncOnce().catch(() => {});
    const { rows } = await db.query(
      `select c.trial_id, t.title, coalesce(s.sections, '[]'::jsonb) as sections
       from consents c join trials t on t.id = c.trial_id
       left join shares s on s.trial_id = c.trial_id and s.patient = c.patient
       where c.patient = $1 order by c.trial_id desc limit 100`, [me]);
    return res.json({ consents: rows });
  }
  if (req.method === "PUT") {
    const id = Number(req.body?.trialId), sections = cleanSections(req.body?.sections ?? []);
    if (!Number.isInteger(id) || sections === null) return res.status(400).json({ error: "Choose valid profile sections." });
    let consented = (await db.query("select 1 from consents where trial_id=$1 and patient=$2", [id, me])).rows.length > 0;
    if (!consented) consented = await readOnly().consented(id, me).catch(() => false); // consent not indexed yet
    if (!consented) return res.status(403).json({ error: "You have not consented to this trial." });
    await db.query(
      `insert into shares(trial_id,patient,sections) values($1,$2,$3)
       on conflict(trial_id,patient) do update set sections=$3, updated_at=now()`, [id, me, JSON.stringify(sections)]);
    return res.json({ ok: true });
  }
  res.status(405).end();
}
