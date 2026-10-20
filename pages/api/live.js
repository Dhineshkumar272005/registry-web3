// Liveness only: no dependencies, so a database or ledger outage never makes the platform restart healthy pods.
export default function handler(req, res) { res.status(200).json({ ok: true }); }
