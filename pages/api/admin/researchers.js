import { limit } from "../../../lib/limit";
import { db, auth, unseal, adminWallets } from "../../../lib/server";

// Administrators review researcher details before a sponsor is shown as verified. Wallets are listed in ADMIN_WALLETS.
export default async function handler(req, res) {
  if (!(await limit(req, res, "admin", 60))) return;
  const me = auth(req, res); if (!me) return;
  if (!adminWallets().includes(me)) return res.status(403).json({ error: "Administrators only." });
  if (req.method !== "GET") return res.status(405).end();
  const filter = req.query.status === "verified" ? "verified and" : req.query.status === "pending" ? "not verified and" : "";
  const after = String(req.query.cursor || "").toLowerCase();
  const rows = (await db.query(`select wallet, data, verified, updated_at from researchers where ${filter} wallet > $1 order by wallet limit 51`, [after])).rows;
  const page = rows.slice(0, 50).map((r) => { const d = unseal(r.data); return { wallet: r.wallet, verified: r.verified, updated: r.updated_at, name: d.name, role: d.role, org: d.org, orgType: d.orgType, country: d.country, email: d.email, orcid: d.orcid, website: d.website, ethics: d.ethics }; });
  res.json({ researchers: page, nextCursor: rows.length > 50 ? page[page.length - 1].wallet : null });
}
