import Layout from "../components/Layout";
import { DISEASES } from "../lib/diseases";
export default function Diseases() {
  return (<Layout title="Rare diseases"><section><h2>Learn about rare diseases</h2>
    <p className="mut">Plain-language summaries for general information, not medical advice. Ask a specialist about your own situation.</p>
    {DISEASES.map((d) => (<details key={d.n}><summary><strong>{d.n}</strong></summary>
      <p><b>What it is.</b> {d.what}</p><p><b>Common symptoms.</b> {d.sym}</p>
      <p><b>How it is diagnosed.</b> {d.dx}</p><p><b>Treatment and care.</b> {d.tx}</p></details>))}
  </section></Layout>);
}
