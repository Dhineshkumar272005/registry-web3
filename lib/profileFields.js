import { DISEASES } from "./diseases";
// One schema drives the form, the API whitelist and validation, and the researcher view.
export const DX = [...DISEASES.map((d) => d.n), "Other or not listed"];
export const SECTIONS = [
  { title: "About you", fields: [
    { k: "name", label: "Full name", req: true },
    { k: "dob", label: "Date of birth", type: "date" },
    { k: "sex", label: "Sex", options: ["Female", "Male", "Intersex", "Prefer not to say"] },
    { k: "country", label: "Country or region" },
    { k: "language", label: "Preferred language" },
    { k: "contact", label: "Email or phone", req: true },
    { k: "prefContact", label: "Best way to reach you", options: ["Email", "Phone call", "Text message", "Through my caregiver"] },
  ] },
  { title: "Diagnosis", fields: [
    { k: "dx", label: "Condition", options: "dx" },
    { k: "dxDate", label: "Month and year of diagnosis" },
    { k: "confirm", label: "How it was confirmed", options: ["Genetic test", "Enzyme or biochemical test", "Clinical diagnosis only", "Not yet confirmed"] },
    { k: "variant", label: "Gene and variant, if known" },
    { k: "stage", label: "Current severity", options: ["Early or mild", "Moderate", "Advanced or severe", "Not sure"] },
  ] },
  { title: "Symptoms and health history", fields: [
    { k: "sym", label: "Current symptoms", long: true },
    { k: "onset", label: "Age when symptoms began" },
    { k: "comorbid", label: "Other health conditions", long: true },
    { k: "family", label: "Family history of this condition", long: true },
    { k: "allergies", label: "Allergies", long: true },
  ] },
  { title: "Treatment", fields: [
    { k: "tx", label: "Current treatments", long: true },
    { k: "pastTx", label: "Past treatments and how they went", long: true },
    { k: "meds", label: "All current medicines", long: true },
  ] },
  { title: "Trial preferences and care team", fields: [
    { k: "priorTrials", label: "Trial experience", options: ["Never taken part", "Taken part before", "In a trial now"] },
    { k: "travel", label: "Travel you could manage", options: ["Local only", "Within my country", "International"] },
    { k: "clinician", label: "Treating clinician and hospital", long: true },
    { k: "caregiver", label: "Parent, guardian or caregiver (required if under 18)", long: true },
  ] },
];
export const ALL = SECTIONS.flatMap((s) => s.fields);
export const EMPTY = Object.fromEntries(ALL.map((f) => [f.k, ""]));
export const opts = (f) => (f.options === "dx" ? DX : f.options);
export const summary = (p) => ALL.filter((f) => p?.[f.k]).map((f) => `${f.label}: ${p[f.k]}`).join("\n");

export function clean(body) {
  const p = {};
  for (const f of ALL) {
    const v = String(body?.[f.k] ?? "").trim().slice(0, f.long ? 1000 : 200);
    if (v && f.options && !opts(f).includes(v)) return { error: `Invalid value for ${f.label}.` };
    if (v && f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "Date of birth must be a valid date." };
    p[f.k] = v;
  }
  if (!p.name || !p.contact) return { error: "Name and contact are required." };
  return { p };
}

// A researcher always receives name and contact, so the patient can be reached. Everything else is released only for
// the sections the patient chose to share with that trial.
export const SECTION_TITLES = SECTIONS.map((s) => s.title);
const ALWAYS = new Set(["name", "contact"]);
export function shareView(profile, sections = []) {
  const out = {};
  for (const s of SECTIONS) for (const f of s.fields) if (ALWAYS.has(f.k) || sections.includes(s.title)) out[f.k] = profile?.[f.k] ?? "";
  return out;
}
export const cleanSections = (x) => (Array.isArray(x) && x.every((t) => SECTION_TITLES.includes(t)) ? [...new Set(x)] : null);
