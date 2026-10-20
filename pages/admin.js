import { useState } from "react";
import Layout from "../components/Layout";
import { connect } from "../lib/chain";

// Administrator console: review researchers and approve or revoke their verified status. Every decision is logged.
export default function Admin() {
  const [w, setW] = useState(null), [rows, setRows] = useState([]), [status, setStatus] = useState("pending"), [msg, setMsg] = useState(""), [notes, setNotes] = useState({});
  const api = async (url, method = "GET", body) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, cache: "no-store", body: body && JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  };
  const load = async (s = status) => setRows((await api(`/api/admin/researchers?status=${s}`)).researchers);
  const signIn = async () => {
    try {
      const c = await connect();
      const { message } = await api("/api/auth/nonce?wallet=" + c.address);
      await api("/api/auth/login", "POST", { wallet: c.address, signature: await c.contract.runner.signMessage(message) });
      setW(c); setMsg(""); await load();
    } catch (e) { setMsg(e.message); }
  };
  const decide = async (r, verified) => {
    try { await api("/api/admin/verify", "POST", { wallet: r.wallet, verified, note: notes[r.wallet] || "" }); setMsg(verified ? "Sponsor verified." : "Verification revoked."); await load(); }
    catch (e) { setMsg(e.message); }
  };
  return (<Layout title="Administration" right={w ? <span className="mut">{w.address.slice(0, 6)}…{w.address.slice(-4)}</span> : <button onClick={signIn}>Sign in as administrator</button>}>
    <section>
      <h1>Sponsor verification</h1>
      <p className="mut">Before approving, confirm the organisation, the e-mail domain and the ethics approval reference through independent channels. Every decision is recorded with your wallet address.</p>
      <p role="status" className={msg && !/verified|revoked/i.test(msg) ? "err" : "ok"}>{msg}</p>
      {w && <><label htmlFor="st">Show</label>
        <select id="st" value={status} onChange={(e) => { setStatus(e.target.value); load(e.target.value).catch((x) => setMsg(x.message)); }}>
          <option value="pending">Awaiting review</option><option value="verified">Verified</option><option value="">All</option></select></>}
      {w && rows.length === 0 && <p className="mut">Nothing to show.</p>}
      {rows.map((r) => (<article className="tcard" key={r.wallet}>
        <div className="th"><h3>{r.name} <span className="mut">({r.role || "role not stated"})</span></h3>{r.verified ? <span className="pill good">Verified</span> : <span className="pill">Awaiting review</span>}</div>
        <dl className="facts">{[["Organisation", r.org], ["Type", r.orgType], ["Country", r.country], ["E-mail", r.email], ["ORCID", r.orcid], ["Web page", r.website], ["Ethics reference", r.ethics]].filter((x) => x[1]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <p className="mut"><code>{r.wallet}</code></p>
        <label htmlFor={"n" + r.wallet}>Note for the record</label>
        <input id={"n" + r.wallet} value={notes[r.wallet] || ""} onChange={(e) => setNotes({ ...notes, [r.wallet]: e.target.value })} />
        {r.verified ? <button className="ghost" onClick={() => decide(r, false)}>Revoke verification</button> : <button onClick={() => decide(r, true)}>Verify this sponsor</button>}
      </article>))}
    </section>
  </Layout>);
}
