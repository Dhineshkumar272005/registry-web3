import { limit } from "../../../lib/limit";
import { verifyMessage } from "ethers";
import { db, loginMessage, setSession } from "../../../lib/server";

export default async function handler(req, res) {
  if (!(await limit(req, res, "login", 10))) return;
  if (req.method !== "POST") return res.status(405).end();
  const w = String(req.body?.wallet || "").toLowerCase();
  const { rows } = await db.query("delete from nonces where wallet=$1 and expires_at>now() returning nonce", [w]);
  if (!rows[0]) return res.status(400).json({ error: "Sign-in challenge expired. Try again." });
  let signer = "";
  try { signer = verifyMessage(loginMessage(rows[0].nonce), req.body.signature).toLowerCase(); } catch {}
  if (signer !== w) return res.status(401).json({ error: "Signature does not match this wallet." });
  setSession(res, w);
  res.json({ ok: true });
}
