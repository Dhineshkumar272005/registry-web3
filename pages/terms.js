import Layout from "../components/Layout";
import { CFG } from "../lib/config";
export default function Page() {
  return (<Layout title="Terms of use"><section>
    <h1>Terms of use</h1>
    {CFG.legalReviewed ? <p className="mut">{CFG.legalUpdated && `Last updated: ${CFG.legalUpdated}`}</p>
      : <p className="mut">Draft text. It must be reviewed and approved by counsel before launch.</p>}
      <h2>Use of the service</h2><p>The service is provided as is, to the extent permitted by law. It does not provide medical advice or diagnosis, and you should not rely on it for medical decisions.</p>
      <h2>Not medical advice</h2><p>Disease information is general. Talk to a qualified clinician about your own care.</p>
      <h2>Your responsibilities</h2><p>You must be 18 or older, or a parent or guardian acting for a minor. Keep your wallet keys safe. Researchers must use patient information only for the trial the patient consented to and must follow applicable ethics and data protection rules.</p>
      <h2>Changes and contact</h2><p>We may change these terms. Operator: {CFG.org}. Contact: {CFG.contact}.</p>
  </section></Layout>);
}
