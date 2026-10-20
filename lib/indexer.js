import { db } from "./server";
import { readOnly } from "./chain";

// Copies ledger events into the database so that page views and researcher lookups never scan the chain.
// Safe to run from many replicas at once: an advisory lock lets one writer proceed and the rest skip.
const CONF = Number(process.env.INDEXER_CONFIRMATIONS ?? 12); // wait this many blocks to avoid reorganisations
const CHUNK = Number(process.env.INDEXER_CHUNK || 2000);
let lastRun = 0, lastDone = 0;

export function maybeSync(minMs = 15000) { // fire-and-forget refresh, at most once per interval per process
  if (Date.now() - lastRun < minMs) return;
  lastRun = Date.now();
  syncOnce().catch((e) => console.error("sync failed:", e.message));
}

// Waits for a sync only when the index is older than maxAgeMs, so busy routes do not hit the ledger on every request.
export async function ensureFresh(maxAgeMs = 3000) {
  if (Date.now() - lastDone < maxAgeMs) return;
  await syncOnce();
}

export async function syncOnce() {
  lastRun = Date.now();
  const c = readOnly();
  const head = (await c.runner.provider.getBlockNumber()) - CONF;
  const start = Number(process.env.DEPLOY_BLOCK || 0);
  let events = 0;
  for (;;) {
    const st = await db.query("select last_block from indexer_state where id=1");
    const from = st.rows[0] ? Number(st.rows[0].last_block) + 1 : start;
    if (from > head) break;
    const to = Math.min(from + CHUNK - 1, head);
    const logs = (await c.queryFilter("*", from, to)).sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
    const info = new Map(await Promise.all(logs.filter((l) => l.eventName === "TrialCreated").map(async (l) => [Number(l.args.id), await c.getTrial(l.args.id)])));
    const cl = await db.connect();
    try {
      await cl.query("begin");
      if (!(await cl.query("select pg_try_advisory_xact_lock(727001) as ok")).rows[0].ok) { await cl.query("rollback"); return { skipped: true }; }
      const again = await cl.query("select last_block from indexer_state where id=1");
      if ((again.rows[0] ? Number(again.rows[0].last_block) + 1 : start) !== from) { await cl.query("rollback"); continue; }
      for (const l of logs) {
        if (l.eventName === "PatientRegistered") await cl.query("insert into patients(wallet) values($1) on conflict do nothing", [l.args.patient.toLowerCase()]);
        else if (l.eventName === "TrialCreated") {
          const id = Number(l.args.id), t = info.get(id);
          await cl.query("insert into trials(id,researcher,title,criteria,block) values($1,$2,$3,$4,$5) on conflict(id) do nothing", [id, t.researcher.toLowerCase(), t.title, JSON.stringify([...t.criteria]), l.blockNumber]);
        } else if (l.eventName === "TrialClosed") await cl.query("update trials set open=false where id=$1", [Number(l.args.id)]);
        else if (l.eventName === "Withdrawn") {
          const id = Number(l.args.id), who = l.args.patient.toLowerCase();
          await cl.query(`with del as (delete from consents where trial_id=$1 and patient=$2 returning 1)
                          update trials set consents = consents - (select count(*) from del) where id=$1`, [id, who]);
          await cl.query("delete from shares where trial_id=$1 and patient=$2", [id, who]);
        } else if (l.eventName === "Consented") {
          const id = Number(l.args.id);
          await cl.query(`with ins as (insert into consents(trial_id,patient,block,tx) values($1,$2,$3,$4) on conflict do nothing returning 1)
                          update trials set consents = consents + (select count(*) from ins) where id=$1`, [id, l.args.patient.toLowerCase(), l.blockNumber, l.transactionHash]);
        }
      }
      await cl.query("insert into indexer_state(id,last_block) values(1,$1) on conflict(id) do update set last_block=$1", [to]);
      await cl.query("commit");
      events += logs.length;
    } catch (e) { await cl.query("rollback").catch(() => {}); throw e; } finally { cl.release(); }
  }
  db.query("delete from nonces where expires_at < now()").catch(() => {});
  db.query("delete from rate_limits where at < now() - interval '1 day'").catch(() => {});
  lastDone = Date.now();
  return { head, events };
}
