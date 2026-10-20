import { db } from "../../lib/server";
import { readOnly } from "../../lib/chain";
// Readiness: reports database, ledger and index freshness.
export default async function handler(req, res) {
  const out = { db: false, chain: false, indexer: null };
  try { await db.query("select 1"); out.db = true; } catch {}
  try { out.block = await readOnly().runner.provider.getBlockNumber(); out.chain = true; } catch {}
  try {
    const r = await db.query("select last_block from indexer_state where id=1");
    if (out.chain) out.indexer = r.rows[0] ? { lastBlock: Number(r.rows[0].last_block), lag: out.block - Number(r.rows[0].last_block) } : { lastBlock: null, lag: null };
  } catch {}
  res.status(out.db && out.chain ? 200 : 503).json(out);
}
