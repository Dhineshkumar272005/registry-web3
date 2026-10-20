// One schema drives the researcher form, the trial form, API validation and the patient-facing trial details.
export const R_SECTIONS = [
  { title: "Researcher and organisation", fields: [
    { k: "name", label: "Full name", req: true },
    { k: "role", label: "Your role", options: ["Principal investigator", "Co-investigator", "Study coordinator", "Sponsor representative"] },
    { k: "org", label: "Organisation or institution", req: true },
    { k: "orgType", label: "Type of organisation", options: ["University or hospital", "Pharmaceutical or biotech company", "Non-profit or patient group", "Government agency"] },
    { k: "country", label: "Country" },
    { k: "email", label: "Work email", req: true, type: "email" },
    { k: "orcid", label: "ORCID iD (optional)" },
    { k: "website", label: "Institution or study web page" },
    { k: "ethics", label: "Ethics committee or IRB reference" },
  ] },
];
export const T_SECTIONS = [
  { title: "Overview", fields: [
    { k: "title", label: "Trial name", req: true },
    { k: "officialTitle", label: "Official title" },
    { k: "registryId", label: "Registry ID, such as an NCT number" },
    { k: "studyType", label: "Study type", options: ["Interventional", "Observational", "Patient registry"] },
    { k: "phase", label: "Phase", options: ["Not applicable", "Phase 1", "Phase 1/2", "Phase 2", "Phase 2/3", "Phase 3", "Phase 4"] },
    { k: "conditions", label: "Condition studied", req: true },
    { k: "summary", label: "Plain-language summary", req: true, long: true },
  ] },
  { title: "Who can join", fields: [
    { k: "ageMin", label: "Minimum age", type: "number" },
    { k: "ageMax", label: "Maximum age", type: "number" },
    { k: "sexElig", label: "Sex", options: ["All", "Female", "Male"] },
    { k: "inclusion", label: "Inclusion criteria", long: true },
    { k: "exclusion", label: "Exclusion criteria", long: true },
    { k: "enrollment", label: "Planned number of participants", type: "number" },
  ] },
  { title: "What taking part involves", fields: [
    { k: "intervention", label: "Treatment or intervention", long: true },
    { k: "duration", label: "Length of participation" },
    { k: "visits", label: "Visits and procedures", long: true },
    { k: "remote", label: "Where visits happen", options: ["Fully on site", "Some remote visits", "Mostly remote"] },
    { k: "compensation", label: "Compensation and travel support", long: true },
  ] },
  { title: "Sponsor and sites", fields: [
    { k: "sponsor", label: "Sponsor", req: true },
    { k: "locations", label: "Study sites and countries", long: true },
    { k: "startDate", label: "Start date", type: "date" },
    { k: "endDate", label: "Expected end date", type: "date" },
    { k: "ethicsApproved", label: "Ethics approval", options: ["Approved", "Pending", "Not required"] },
    { k: "questionsContact", label: "Email for patient questions", type: "email" },
  ] },
];
const R_ALL = R_SECTIONS.flatMap((s) => s.fields), T_ALL = T_SECTIONS.flatMap((s) => s.fields);
export const EMPTY_R = Object.fromEntries(R_ALL.map((f) => [f.k, ""]));
export const EMPTY_T = Object.fromEntries(T_ALL.map((f) => [f.k, ""]));
export const summaryOf = (fields, o) => fields.filter((f) => o?.[f.k]).map((f) => `${f.label}: ${o[f.k]}`).join("\n");
export const trialSummary = (m) => summaryOf(T_ALL.filter((f) => f.k !== "title"), m);

function check(fields, body) {
  const p = {};
  for (const f of fields) {
    const v = String(body?.[f.k] ?? "").trim().slice(0, f.long ? 2000 : 200);
    if (f.req && !v) return { error: `${f.label} is required.` };
    if (v && f.options && !f.options.includes(v)) return { error: `Invalid value for ${f.label}.` };
    if (v && f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${f.label} must be a valid date.` };
    if (v && f.type === "number" && !/^\d{1,6}$/.test(v)) return { error: `${f.label} must be a whole number.` };
    if (v && f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) return { error: `${f.label} must be an email address.` };
    p[f.k] = v;
  }
  return { p };
}
export const cleanResearcher = (b) => check(R_ALL, b);
export const cleanTrial = (b) => check(T_ALL, b);
