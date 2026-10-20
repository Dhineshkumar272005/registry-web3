import { SECTIONS, ALL, opts } from "../lib/profileFields";
export default function ProfileForm({ pf, setF }) {
  const n = ALL.filter((f) => pf[f.k]).length;
  return (<>
    <p className="mut">{n} of {ALL.length} details filled in. Only name and contact are required, so share only what you are comfortable with. If the patient is under 18, a parent or guardian should complete this form.</p>
    {SECTIONS.map((s) => (<fieldset key={s.title}><legend>{s.title}</legend>
      {s.fields.map((f) => { const id = "f_" + f.k; return (<div key={f.k}>
        <label htmlFor={id}>{f.label}{f.req ? " *" : ""}</label>
        {f.options ? <select id={id} value={pf[f.k] || ""} onChange={setF(f.k)}><option value="">Select</option>{opts(f).map((o) => <option key={o}>{o}</option>)}</select>
          : f.long ? <textarea id={id} rows={3} maxLength={1000} value={pf[f.k] || ""} onChange={setF(f.k)} />
          : <input id={id} type={f.type || "text"} maxLength={200} value={pf[f.k] || ""} onChange={setF(f.k)} />}
      </div>); })}
    </fieldset>))}
  </>);
}
