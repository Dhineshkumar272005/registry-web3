import { CFG, isProd } from "../lib/config";
export default function Hero({ stats, onTab }) {
  return (<div className="hero">
    <h1>Find the right trial without giving up your privacy</h1>
    <p className="lead">Patients prove they qualify without exposing their records. Researchers see who matches, and details are released only when a patient says yes.</p>
    <div className="cta">
      <div className="card"><h3>For patients</h3><p>Build a private profile, see trials you qualify for, and decide who sees your details.</p><button onClick={() => onTab("patient")}>Create my profile</button></div>
      <div className="card"><h3>For researchers</h3><p>Publish a trial and reach matching patients without seeing anyone until they agree.</p><button className="ghost" onClick={() => onTab("researcher")}>Publish a trial</button></div>
    </div>
    <div className="steps">
      <div className="step"><b>1</b><h3>Register</h3><p>Add condition tags. Only a scrambled fingerprint goes on the public chain.</p></div>
      <div className="step"><b>2</b><h3>Publish criteria</h3><p>Researchers post what a trial needs.</p></div>
      <div className="step"><b>3</b><h3>Consent</h3><p>The contract checks your proof, then your profile is released to that trial only.</p></div></div>
    {stats && <div className="stats"><div><strong>{stats.patients}</strong>patients registered</div><div><strong>{stats.trials}</strong>trials published</div><div><strong>{CFG.chainShort}</strong>{isProd ? "ledger network" : "test network"}</div></div>}
  </div>);
}
