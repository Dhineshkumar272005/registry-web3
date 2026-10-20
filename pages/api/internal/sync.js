import crypto from "crypto";
import { syncOnce } from "../../../lib/indexer";

// Called by the indexer worker. Protected by a shared secret, never exposed through the public ingress path.
export default async function handler(req, res) {
  const given = Buffer.from(String(req.headers["x-cron-token"] || "")), want = Buffer.from(process.env.CRON_TOKEN || "");
  if (!want.length || given.length !== want.length || !crypto.timingSafeEqual(given, want)) return res.status(401).json({ error: "Unauthorized" });
  try { res.json(await syncOnce()); } catch (e) { res.status(500).json({ error: e.message }); }
}
