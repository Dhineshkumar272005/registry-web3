export default function Fields({ sections, values, setF, idp }) {
  return sections.map((s) => (<fieldset key={s.title}><legend>{s.title}</legend>
    {s.fields.map((f) => { const id = idp + f.k, v = values[f.k] || ""; return (<div key={f.k}>
      <label htmlFor={id}>{f.label}{f.req ? " *" : ""}</label>
      {f.options ? <select id={id} value={v} onChange={setF(f.k)}><option value="">Select</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select>
        : f.long ? <textarea id={id} rows={3} maxLength={2000} value={v} onChange={setF(f.k)} />
        : <input id={id} type={f.type || "text"} maxLength={200} value={v} onChange={setF(f.k)} />}
    </div>); })}
  </fieldset>));
}
