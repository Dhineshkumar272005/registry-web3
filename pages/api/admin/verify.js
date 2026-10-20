import { limit } from "../../../lib/limit";
import { db, auth, adminWallets } from "../../../lib/server";

// Approve or revoke a sponsor. Every decision is written to admin_log in the same statement.
export default async function handler(req, res) {
  if (!(await limit(req, res, "admin", 60))) return;
  const me = auth(req, res); if (!me) return;
  if (!adminWallets().includes(me)) return res.status(403).json({ error: "Administrators only." });
  if (req.method !== "POST") return res.status(405).end();
  const wallet = String(req.body?.wallet || "").toLowerCase(), verified = req.body?.verified;
  if (!/^0x[0-9a-f]{40}$/.test(wallet) || typeof verified !== "boolean") return res.status(400).json({ error: "Wallet and a true or false decision are required." });
  const note = String(req.body?.note || "").slice(0, 500);
  const { rowCount } = await db.query(
    `with u as (update researchers set verified=$2 where wallet=$1 returning wallet)
     insert into admin_log(admin, researcher, action, note) select $3, wallet, $4, $5 from u`,
    [wallet, verified, me, verified ? "verify" : "revoke", note]);
  if (!rowCount) return res.status(404).json({ error: "No such researcher." });
  res.json({ ok: true });
}
