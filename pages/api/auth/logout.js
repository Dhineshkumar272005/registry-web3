import { clearSession } from "../../../lib/server";
export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  clearSession(res); res.json({ ok: true });
}
