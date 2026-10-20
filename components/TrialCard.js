import { trialSummary } from "../lib/trialFields";
const ages = (m) => (m.ageMin || m.ageMax ? `${m.ageMin || "Any"} to ${m.ageMax || "any age"}` : "");
export default function TrialCard({ t, w, eligible, consented, onConsent }) {
  const m = t.meta;
  const facts = m ? [["Phase", m.phase], ["Ages", ages(m)], ["Duration", m.duration], ["Location", (m.locations || "").split(/[,\n]/)[0]]].filter((x) => x[1]) : [];
  return (<article className="tcard">
    <div className="th"><h3>{t.title}</h3>{m?.verified ? <span className="pill good">Verified sponsor</span> : <span className="pill">Unverified</span>}</div>
    <p className="mut">{m ? m.sponsor : "Details pending"}</p>
    {m?.summary && <p>{m.summary}</p>}
    {facts.length > 0 && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
    {m && <details><summary>Full eligibility and study details</summary><div className="prof">{trialSummary(m)}</div></details>}
    <div className="tfoot">
      <span className="mut">{t.consents} patients consented. Needs {t.criteria.length} matching {t.criteria.length > 1 ? "tags" : "tag"}.</span>
      <button disabled={!w || !eligible || consented} onClick={onConsent}>{!w ? "Connect wallet to continue" : consented ? "You have consented" : eligible ? "Consent and share with this trial" : "Your tags don't match"}</button>
    </div>
  </article>);
}
