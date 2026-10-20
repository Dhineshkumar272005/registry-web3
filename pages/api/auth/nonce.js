import { limit } from "../../../lib/limit";
import { isAddress } from "ethers";
import crypto from "crypto";
import { db, loginMessage } from "../../../lib/server";

export default async function handler(req, res) {
  if (!(await limit(req, res, "nonce", 10))) return;
  const w = String(req.query.wallet || "").toLowerCase();
  if (!isAddress(w)) return res.status(400).json({ error: "Bad wallet address" });
  const nonce = crypto.randomBytes(16).toString("hex");
  await db.query(
    `insert into nonces(wallet,nonce,expires_at) values($1,$2,now()+interval '5 minutes')
     on conflict(wallet) do update set nonce=$2, expires_at=now()+interval '5 minutes'`, [w, nonce]);
  res.json({ message: loginMessage(nonce) });
}
