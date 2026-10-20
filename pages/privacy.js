import Layout from "../components/Layout";
import { CFG } from "../lib/config";
export default function Page() {
  return (<Layout title="Privacy policy"><section>
    <h1>Privacy policy</h1>
    {CFG.legalReviewed ? <p className="mut">{CFG.legalUpdated && `Last updated: ${CFG.legalUpdated}`}</p>
      : <p className="mut">Draft text. It must be reviewed and approved by counsel before launch.</p>}
      <h2>What we collect</h2><p>Your wallet address, the profile you enter (name, contact, diagnosis, age, symptoms), and the condition tags you register. Tags are turned into a fingerprint in your browser. Your plain tags are never sent to us.</p>
      <h2>Where it is stored</h2><p>Your profile is encrypted and kept in a private user database. The shared ledger holds only your tag fingerprint and a record that you consented to a trial. It holds no names, contacts or health details.</p>
      <h2>Who can see it</h2><p>A researcher can read your profile only for a trial they own, and only after you consent to that trial. Each time a profile is read, the access is logged.</p>
      <h2>Your rights</h2><p>You can delete your profile at any time from the site. Ledger records cannot be erased, which is why they contain no personal details. Contact us to exercise other rights under applicable data protection law.</p>
      <h2>Who is responsible</h2><p>{CFG.org}. Contact: {CFG.contact}.</p>
  </section></Layout>);
}
