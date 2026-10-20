import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { isProd } from "../lib/config";
import Hero from "../components/Hero";
import TrialCard from "../components/TrialCard";
import { ADDRESS, CHAIN, connect, buildTree, loadTree, tagLeaf, store, fetchStored, SEED_MESSAGE } from "../lib/chain";
import { makeKeys } from "../lib/crypto";
import ProfileForm from "../components/ProfileForm";
import { EMPTY, summary, SECTION_TITLES } from "../lib/profileFields";
import Fields from "../components/Fields";
import { R_SECTIONS, T_SECTIONS, EMPTY_R, EMPTY_T, trialSummary } from "../lib/trialFields";

const tagsOf = (s) => s.split(",").map((t) => t.trim()).filter(Boolean);

export default function Home() {
  const [w, setW] = useState(null); // { address, contract }
  const [tab, setTab] = useState("patient");
  const [msg, setMsg] = useState({ t: "", bad: false });
  const [trials, setTrials] = useState([]);
  const [nextCursor, setNext] = useState(null);
  const [conds, setConds] = useState([]);
  const [cond, setCond] = useState("");
  const [q, setQ] = useState("");
  const [myTrials, setMyTrials] = useState([]);
  const [shareSecs, setShareSecs] = useState([]);
  const [myConsents, setMyConsents] = useState([]);
  const [stats, setStats] = useState(null);
  const [tags, setTags] = useState("");
  const [pf, setPf] = useState(EMPTY);
  const setF = (k) => (e) => setPf({ ...pf, [k]: e.target.value });
  const [rp, setRp] = useState(EMPTY_R);
  const setR = (k) => (e) => setRp({ ...rp, [k]: e.target.value });
  const [tf, setTf] = useState(EMPTY_T);
  const setT = (k) => (e) => setTf({ ...tf, [k]: e.target.value });
  const [title, setTitle] = useState("");
  const [crit, setCrit] = useState("");
  const [contacts, setContacts] = useState({});

  const say = (t, bad = false) => setMsg({ t, bad });
  const run = async (label, fn) => {
    try { say(label + "…"); await fn(); say("Done."); }
    catch (e) { say(e.shortMessage || e.reason || e.message, true); }
  };

  const api = async (url, method = "GET", body) => {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, cache: "no-store", body: body && JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  };

  // Trials come from the indexed API in pages, so the browser never reads the ledger trial by trial.
  async function loadTrials(reset = true, cursor = null) {
    if (!ADDRESS) return;
    const p = new URLSearchParams({ limit: "20" });
    if (!reset && cursor !== null) p.set("cursor", String(cursor));
    if (q) p.set("q", q);
    if (cond) p.set("condition", cond);
    const j = await api("/api/trials?" + p);
    setTrials((prev) => (reset ? j.trials : [...prev, ...j.trials]));
    setNext(j.nextCursor); setStats(j.stats); setConds(j.conditions || []);
  }
  async function loadMine(addr) {
    const j = await api("/api/trials?limit=50&researcher=" + addr);
    setMyTrials(j.trials);
  }
  async function loadConsents() { setMyConsents((await api("/api/shares")).consents); }
  // The index trails the ledger by a moment, so refresh once more shortly after an action.
  async function refresh(again = true) {
    await loadTrials(true);
    if (w) { await loadMine(w.address); await loadConsents(); }
    if (again) setTimeout(() => refresh(false).catch(() => {}), 4000);
  }
  const signOut = async () => { await api("/api/auth/logout", "POST").catch(() => {}); setW(null); setMyConsents([]); setMyTrials([]); setPf(EMPTY); setRp(EMPTY_R); };
  useEffect(() => {
    const h = setTimeout(() => loadTrials(true).catch(() => say("Could not load trials. Please try again shortly.", true)), 300);
    return () => clearTimeout(h);
  }, [q, cond]);

  const link = () => run("Connecting wallet", async () => {
    const c = await connect();
    const { message } = await api("/api/auth/nonce?wallet=" + c.address);
    const signature = await c.contract.runner.signMessage(message);
    await api("/api/auth/login", "POST", { wallet: c.address, signature });
    setW(c);
    loadMine(c.address).catch(() => {});
    loadConsents().catch(() => {});
    const me = await api("/api/profile").catch(() => null);
    if (me && me.profile) setPf((p) => ({ ...p, ...me.profile }));
    const rme = await api("/api/researcher").catch(() => null);
    if (rme && rme.profile) setRp((p) => ({ ...p, ...rme.profile }));
  });
  const mine = w ? fetchStored("tree:" + w.address) : null;
  const myLeaves = mine ? new Set(loadTree(mine.dump) && [...loadTree(mine.dump).entries()].map(([, v]) => v[0])) : new Set();

  const register = () => run("Registering on-chain", async () => {
    await api("/api/profile", "PUT", pf); // user details go to the separate database, never the chain
    const seed = await w.contract.runner.signMessage(SEED_MESSAGE); // proofs can be rebuilt later from this wallet and the same tags
    const tree = buildTree(tagsOf(tags), seed);
    store("tree:" + w.address, { dump: tree.dump() });
    await (await w.contract.registerPatient(tree.root)).wait();
    await refresh();
  });

  const restore = () => run("Rebuilding your proofs", async () => {
    const seed = await w.contract.runner.signMessage(SEED_MESSAGE);
    const tree = buildTree(tagsOf(tags), seed);
    const onChain = await w.contract.patientRoot(w.address);
    if (tree.root.toLowerCase() !== onChain.toLowerCase()) throw new Error("These tags do not reproduce the root registered for this wallet. Check the spelling, or register again.");
    store("tree:" + w.address, { dump: tree.dump() });
    await refresh();
  });
  const updateShare = (c) => run("Updating what is shared", async () => { await api("/api/shares", "PUT", { trialId: c.trial_id, sections: shareSecs }); await loadConsents(); });
  const withdraw = (c) => run("Withdrawing consent", async () => { await (await w.contract.withdraw(c.trial_id)).wait(); await refresh(); });

  const consent = (t) => run("Verifying proof and sharing contact", async () => {
    const tree = loadTree(mine.dump);
    const proofs = t.criteria.map((l) => tree.getProof([l]));
    await (await w.contract.consent(t.id, t.criteria, proofs, "0x")).wait();
    await api("/api/shares", "PUT", { trialId: t.id, sections: shareSecs }); // what this trial may see, chosen by the patient
    await refresh();
  });

  const create = () => run("Publishing trial", async () => {
    const keys = await makeKeys();
    store("rk:" + keys.pub, keys.priv);
    await api("/api/researcher", "PUT", rp);
    const rc = await (await w.contract.createTrial(tf.title, tagsOf(crit).map(tagLeaf), keys.pub)).wait();
    const ev = rc.logs.map((l) => { try { return w.contract.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "TrialCreated");
    await api("/api/trial-meta", "POST", { trialId: Number(ev.args.id), ...tf });
    setTf(EMPTY_T); setCrit("");
    await refresh();
  });

  const reveal = (t) => run("Loading consented patients", async () => {
    const { patients } = await api("/api/trial-contacts?trialId=" + t.id);
    setContacts((c) => ({ ...c, [t.id]: patients.map((p) => ({ patient: p.wallet,
      text: p.profile ? summary(p.profile) : "(patient deleted their data)" })) }));
  });

  return (
    <Layout right={w ? <><span className="mut">{w.address.slice(0, 6)}…{w.address.slice(-4)}</span> <button className="ghost" onClick={signOut}>Sign out</button></> : <button onClick={link}>Connect wallet</button>}>
      <Hero stats={stats} onTab={(t) => { setTab(t); setTimeout(() => document.getElementById("tabs")?.scrollIntoView({ behavior: "smooth" }), 0); }} />

      <p className="mut">Network: {CHAIN.name}.{!isProd && " Staging environment: do not enter real medical details."}
        </p>
      {!ADDRESS && <p className="err">Set NEXT_PUBLIC_REGISTRY_ADDRESS to your deployed contract.</p>}
      <p className={msg.bad ? "err" : "ok"} role="status">{msg.t}</p>

      <div className="tabs" id="tabs">
        <button className={tab === "patient" ? "" : "ghost"} onClick={() => setTab("patient")}>I'm a patient</button>
        <button className={tab === "researcher" ? "" : "ghost"} onClick={() => setTab("researcher")}>I'm a researcher</button>
      </div>

      {tab === "patient" && (<>
        <section>
          <h2>Register your condition tags</h2>
          <p className="mut">Tags are hashed in your browser. Only a Merkle root goes on-chain, mixed with random filler. If you clear your browser data, enter the same tags and choose Rebuild my proofs.</p>
          <label>Conditions or biomarkers, separated by commas
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="fabry disease, gla mutation" /></label>
          <ProfileForm pf={pf} setF={setF} />
          <p className="mut">Saved in a separate encrypted user database, not on the blockchain, and released only to trials you consent to.</p>
          <button disabled={!w || !tagsOf(tags).length || !pf.name || !pf.contact} onClick={register}>Save profile and register</button>{" "}
          <button className="ghost" disabled={!w} onClick={() => run("Deleting your data", async () => { await api("/api/profile", "DELETE"); setPf(EMPTY); })}>Delete my data</button>{" "}
          <button className="ghost" disabled={!w || !tagsOf(tags).length} onClick={restore}>Rebuild my proofs</button>
          {mine && <p className="mut">Your tag proofs are saved in this browser. Clearing site data means registering again.</p>}
        </section>
        <section>
          <h2>Trials looking for patients</h2>
          <p className="mut">Name and contact are always shared with a trial you consent to, so the team can reach you. Choose what else to share:</p>
          <fieldset><legend>Also share with trials I consent to</legend>
            {SECTION_TITLES.map((s) => (<label key={s} style={{ fontWeight: 400 }}><input type="checkbox" checked={shareSecs.includes(s)} onChange={(e) => setShareSecs(e.target.checked ? [...shareSecs, s] : shareSecs.filter((x) => x !== s))} style={{ width: "auto", marginRight: 8 }} />{s}</label>))}
          </fieldset>
          <label htmlFor="q">Search trials</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" />
          {conds.length > 0 && <select aria-label="Filter by condition" value={cond} onChange={(e) => setCond(e.target.value)}><option value="">All conditions</option>{conds.map((c) => <option key={c}>{c}</option>)}</select>}
          {trials.filter((t) => t.open).length === 0 && <p className="mut">No open trials yet. Researchers can publish one from the researcher tab.</p>}
          {trials.filter((t) => t.open).map((t) => {
            const eligible = mine && t.criteria.every((l) => myLeaves.has(l));
            return (
              <TrialCard key={t.id} t={t} w={w} eligible={eligible} consented={myConsents.some((c) => c.trial_id === t.id)} onConsent={() => consent(t)} />);
          })}
          {nextCursor !== null && <button className="ghost" onClick={() => run("Loading more trials", () => loadTrials(false, nextCursor))}>Load more trials</button>}
        </section>
        <section>
          <h2>Your consents</h2>
          {myConsents.length === 0 ? <p className="mut">You have not consented to any trial.</p> : myConsents.map((c) => (
            <div className="trial" key={c.trial_id}>
              <strong>{c.title}</strong>
              <div className="mut">Also shared: {c.sections.length ? c.sections.join(", ") : "nothing beyond name and contact"}</div>
              <button className="ghost" onClick={() => updateShare(c)}>Use my current sharing choice</button>{" "}
              <button className="ghost" onClick={() => withdraw(c)}>Withdraw consent</button>
            </div>))}
          <p className="mut">Withdrawing stops future access. A researcher who already read your details may have kept them.</p>
        </section>
      </>)}

      {tab === "researcher" && (<>
        <section>
          <h2>Your researcher profile</h2>
          <p className="mut">Kept in the private user database. A sponsor is shown as verified only after an administrator checks these details.</p>
          <Fields sections={R_SECTIONS} values={rp} setF={setR} idp="r_" />
        </section>
        <section>
          <h2>Publish a trial</h2>
          <p className="mut">Everything below except the matching tags is shown publicly to patients. Do not include personal data.</p>
          <Fields sections={T_SECTIONS} values={tf} setF={setT} idp="t_" />
          <label htmlFor="crit">Matching tags, separated by commas (up to 8)</label>
          <input id="crit" value={crit} onChange={(e) => setCrit(e.target.value)} placeholder="fabry disease, gla mutation" />
          <p className="mut">Tags are hashed on-chain and matched privately against patient fingerprints.</p>
          <button disabled={!w || !tf.title || !tf.conditions || !tf.summary || !tf.sponsor || !rp.name || !rp.org || !rp.email || !tagsOf(crit).length} onClick={create}>Publish trial</button>
        </section>
        <section>
          <h2>Your trials</h2>
          {!w ? <p className="mut">Connect your wallet to see your trials.</p> :
            myTrials.map((t) => (
              <div className="trial" key={t.id}>
                <strong>{t.title}</strong> <span className="mut">{t.open ? "open" : "closed"}, {t.consents} consented</span>
                <div>
                  <button className="ghost" onClick={() => reveal(t)}>Show consented contacts</button>{" "}
                  {t.open && <button className="ghost" onClick={() => run("Closing trial", async () => { await (await w.contract.closeTrial(t.id)).wait(); await refresh(); })}>Close trial</button>}
                </div>
                {(contacts[t.id] || []).map((c) => <div key={c.patient}><code>{c.patient}</code><div className="prof">{c.text}</div></div>)}
              </div>))}
        </section>
      </>)}
    </Layout>
  );
}
