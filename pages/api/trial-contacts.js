import { limit } from "../../lib/limit";
import { readOnly } from "../../lib/chain";
import { db, auth, unseal } from "../../lib/server";
import { ensureFresh } from "../../lib/indexer";
import { shareView } from "../../lib/profileFields";

// A researcher gets a profile only if (1) they own the trial and (2) the ledger logged that patient's consent.
// What they see is limited to the sections the patient chose to share. Consents are read in pages.
export default async function handler(req, res) {
  if (!(await limit(req, res, "contacts", 20))) return;
  const me = auth(req, res); if (!me) return;
  const id = Number(req.query.trialId);
  await ensureFresh().catch(() => {}); // index is refreshed at most every 3 seconds
  let owner = (await db.query("select researcher from trials where id=$1", [id])).rows[0]?.researcher;
  if (!owner) owner = (await readOnly().getTrial(id).catch(() => null))?.researcher?.toLowerCase(); // not indexed yet
  if (!owner || owner !== me) return res.status(403).json({ error: "Not your trial." });
  const size = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const after = String(req.query.cursor || "").toLowerCase();
  const rows = (await db.query(
    `select c.patient, s.sections from consents c
     left join shares s on s.trial_id = c.trial_id and s.patient = c.patient
     where c.trial_id=$1 and c.patient > $2 order by c.patient limit $3`, [id, after, size + 1])).rows;
  const page = rows.slice(0, size), wallets = page.map((r) => r.patient);
  const profiles = new Map();
  if (wallets.length) {
    for (const r of (await db.query("select wallet, data from users where wallet = any($1)", [wallets])).rows) profiles.set(r.wallet, unseal(r.data));
    await db.query("insert into access_log(trial_id,patient,researcher) select $1, unnest($2::text[]), $3", [id, wallets, me]);
  }
  res.json({
    patients: page.map((r) => ({ wallet: r.patient, shared: r.sections || [], profile: profiles.has(r.patient) ? shareView(profiles.get(r.patient), r.sections || []) : null })),
    nextCursor: rows.length > size ? page[page.length - 1].patient : null,
  });
}
