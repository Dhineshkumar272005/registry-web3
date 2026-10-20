// End-to-end checks against a running stack.
//   1. npx hardhat node                      (local chain)
//   2. deploy the contract and build/start the app with INDEXER_CONFIRMATIONS=0 and a CRON_TOKEN set
//   3. BASE=http://localhost:3000 NEXT_PUBLIC_REGISTRY_ADDRESS=0x... DATABASE_URL=... CRON_TOKEN=... node e2e/e2e.mjs
import { JsonRpcProvider, HDNodeWallet, Contract, keccak256, toUtf8Bytes, randomBytes, hexlify } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import pg from "pg";

const BASE = process.env.BASE || "http://localhost:3000", ADDR = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS, TOKEN = process.env.CRON_TOKEN;
// cacheTimeout -1 stops ethers from reusing a stale transaction count between back-to-back sends
const prov = new JsonRpcProvider(process.env.RPC || "http://127.0.0.1:8545", undefined, { cacheTimeout: -1 });
const mn = "test test test test test test test test test test test junk";
const W = (i) => HDNodeWallet.fromPhrase(mn, undefined, `m/44'/60'/0'/0/${i}`).connect(prov);
const [sponsorA, sponsorB, outsider, anna, mei, ravi, adminW] = [11, 12, 13, 14, 15, 16, 17].map(W); // adminW must be listed in ADMIN_WALLETS
const ABI = ["function registerPatient(bytes32)", "function createTrial(string,bytes32[],bytes) returns (uint256)", "function closeTrial(uint256)",
  "function consent(uint256,bytes32[],bytes32[][],bytes)", "function trialCount() view returns (uint256)", "function withdraw(uint256)"];
const chain = (s) => new Contract(ADDR, ABI, s);
const leaf = (s) => keccak256(toUtf8Bytes(s.trim().toLowerCase()));
const tree = (tags) => { const l = tags.map(leaf); while (l.length < 16) l.push(hexlify(randomBytes(32))); return StandardMerkleTree.of(l.map((x) => [x]), ["bytes32"]); };
let pass = 0, fail = 0;
const ok = (name, c) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + name); };
const call = (ck, p, method = "GET", body, extra = {}) => fetch(BASE + p, { method, headers: { "Content-Type": "application/json", cookie: ck || "", ...extra }, body: body && JSON.stringify(body) });
const j = async (r) => r.json().catch(() => ({}));
async function login(x) {
  const { message } = await j(await call("", `/api/auth/nonce?wallet=${x.address}`));
  const r = await call("", "/api/auth/login", "POST", { wallet: x.address, signature: await x.signMessage(message) });
  return { status: r.status, cookie: (r.headers.get("set-cookie") || "").split(";")[0] };
}
const sync = () => call("", "/api/internal/sync", "GET", undefined, { "x-cron-token": TOKEN });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();

// ---------- sign-in and patient data ----------
ok("sign-in refused when signed by another wallet", (await (async () => { const { message } = await j(await call("", `/api/auth/nonce?wallet=${anna.address}`)); return (await call("", "/api/auth/login", "POST", { wallet: anna.address, signature: await ravi.signMessage(message) })).status; })()) === 401);
const S = await login(sponsorA), SB = await login(sponsorB), O = await login(outsider), A = await login(anna), M = await login(mei), R = await login(ravi), AD = await login(adminW);
ok("sign-in issues a session cookie", A.status === 200 && A.cookie.startsWith("session="));
ok("profile needs a session", (await call("", "/api/profile")).status === 401);
const annaP = { name: "Anna Fischer", contact: "anna.sample@example.org", dx: "Fabry disease", sex: "Female", country: "Germany" };
ok("patients save profiles", (await call(A.cookie, "/api/profile", "PUT", annaP)).status === 200 && (await call(M.cookie, "/api/profile", "PUT", { name: "Mei Lin", contact: "mei@example.org" })).status === 200);
ok("invalid profile choice rejected", (await call(A.cookie, "/api/profile", "PUT", { ...annaP, sex: "Alien" })).status === 400);
ok("profile reads back intact", (await j(await call(A.cookie, "/api/profile"))).profile.country === "Germany");
const rawProfiles = (await db.query("select data from users")).rows.map((r) => r.data.toString("latin1")).join("|");
ok("stored profiles are ciphertext", !/Anna|Fischer|example\.org|Germany/.test(rawProfiles));

// ---------- researcher and trial details ----------
const RP = { name: "Dr Maria Okafor", role: "Principal investigator", org: "Riverside University Hospital", email: "m.okafor@example.org" };
const first = Number(await chain(sponsorA).trialCount());
const mk = (title, cond, tags, s) => chain(s).createTrial(title, tags.map(leaf), "0x04" + "11".repeat(64)).then((t) => t.wait());
const T = (id, title, cond, extra = {}) => ({ trialId: id, title, conditions: cond, summary: `Study of ${cond}.`, sponsor: "Riverside University Hospital", phase: "Phase 3", ...extra });
await mk("Home infusion study in Fabry disease", "Fabry disease", ["fabry disease"], sponsorA);
await mk("Oral therapy in Gaucher disease", "Gaucher disease", ["gaucher disease"], sponsorB);
await mk("Exercise study in late-onset Pompe disease", "Pompe disease", ["pompe disease"], sponsorA);
const [t1, t2, t3] = [first, first + 1, first + 2];
ok("trial details refused before a researcher profile exists", (await call(S.cookie, "/api/trial-meta", "POST", T(t1, "Home infusion study in Fabry disease", "Fabry disease"))).status === 400);
ok("researcher profile with bad email rejected", (await call(S.cookie, "/api/researcher", "PUT", { ...RP, email: "nope" })).status === 400);
ok("researcher profiles saved", (await call(S.cookie, "/api/researcher", "PUT", RP)).status === 200 && (await call(SB.cookie, "/api/researcher", "PUT", { ...RP, name: "Dr Kenji Arai", org: "Harborview Institute" })).status === 200);
ok("non-owner cannot attach details to another's trial", (await call(O.cookie, "/api/trial-meta", "POST", T(t1, "x", "x"))).status === 403);
ok("missing required field rejected", (await call(S.cookie, "/api/trial-meta", "POST", { ...T(t1, "Home", "Fabry disease"), summary: "" })).status === 400);
ok("owners publish trial details", (await call(S.cookie, "/api/trial-meta", "POST", T(t1, "Home infusion study in Fabry disease", "Fabry disease"))).status === 200
  && (await call(SB.cookie, "/api/trial-meta", "POST", T(t2, "Oral therapy in Gaucher disease", "Gaucher disease"))).status === 200
  && (await call(S.cookie, "/api/trial-meta", "POST", T(t3, "Exercise study in late-onset Pompe disease", "Pompe disease"))).status === 200);

// ---------- indexer and public listing ----------
ok("internal sync refuses a missing token", (await call("", "/api/internal/sync")).status === 401);
const s1 = await j(await sync());
ok("internal sync accepts the token and indexes events", (await sync()).status === 200 && s1.head !== undefined);
const p1 = await j(await call("", `/api/trials?limit=2`));
ok("list returns a page of 2 with a cursor, newest first", p1.trials.length === 2 && p1.trials[0].id === t3 && p1.nextCursor === p1.trials[1].id);
const p2 = await j(await call("", `/api/trials?limit=2&cursor=${p1.nextCursor}`));
ok("next page continues without overlap", p2.trials.length >= 1 && p2.trials[0].id < p1.nextCursor && !p2.trials.some((t) => p1.trials.some((x) => x.id === t.id)));
ok("search finds only the matching trial", (await j(await call("", "/api/trials?q=pompe"))).trials.every((t) => /pompe/i.test(t.title)) && (await j(await call("", "/api/trials?q=pompe"))).trials.length === 1);
ok("condition filter works", (await j(await call("", "/api/trials?condition=" + encodeURIComponent("Fabry disease")))).trials.every((t) => t.meta.conditions === "Fabry disease"));
ok("page size is capped at 50", (await j(await call("", "/api/trials?limit=1000"))).trials.length <= 50);
ok("public list never exposes researcher name or email", !JSON.stringify(await j(await call("", "/api/trials?limit=50"))).includes("okafor"));
ok("trials start unverified", (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).meta.verified === false);
ok("non-administrators cannot list researchers", (await call(S.cookie, "/api/admin/researchers")).status === 403);
ok("administrators see researcher details awaiting review", (await j(await call(AD.cookie, "/api/admin/researchers?status=pending"))).researchers.some((r) => r.wallet === sponsorA.address.toLowerCase() && r.email === "m.okafor@example.org"));
ok("non-administrators cannot verify", (await call(S.cookie, "/api/admin/verify", "POST", { wallet: sponsorA.address, verified: true })).status === 403);
ok("administrators verify a sponsor", (await call(AD.cookie, "/api/admin/verify", "POST", { wallet: sponsorA.address, verified: true, note: "ethics reference checked" })).status === 200);
ok("verification appears in the public list", (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).meta.verified === true);
ok("verifying an unknown researcher gives 404", (await call(AD.cookie, "/api/admin/verify", "POST", { wallet: outsider.address, verified: true })).status === 404);
ok("decisions are logged with the administrator", (await db.query("select count(*)::int n from admin_log where admin=$1 and action='verify'", [adminW.address.toLowerCase()])).rows[0].n === 1);

// ---------- consent, access and counts ----------
const ta = tree(["fabry disease", "gla mutation"]), tm = tree(["fabry disease"]), tr = tree(["gaucher disease"]);
await (await chain(anna).registerPatient(ta.root)).wait(); await (await chain(mei).registerPatient(tm.root)).wait(); await (await chain(ravi).registerPatient(tr.root)).wait();
const lf = [leaf("fabry disease")];
await (await chain(anna).consent(t1, lf, [ta.getProof(lf)], "0x")).wait();
await (await chain(mei).consent(t1, lf, [tm.getProof(lf)], "0x")).wait();
await sync();
ok("consent counts update after indexing", (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).consents === 2);
const before = (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).consents;
await sync(); await sync();
ok("re-running the indexer does not double count", (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).consents === before);
ok("a non-owner is refused contacts", (await call(O.cookie, `/api/trial-contacts?trialId=${t1}`)).status === 403);
ok("a patient who did not consent is refused contacts", (await call(R.cookie, `/api/trial-contacts?trialId=${t1}`)).status === 403);
// ---------- patient-controlled sharing ----------
const annaOf = async () => (await j(await call(S.cookie, `/api/trial-contacts?trialId=${t1}&limit=100`))).patients.find((p) => p.wallet === anna.address.toLowerCase());
const pre = (await annaOf()).profile;
ok("without a sharing choice only name and contact are released", pre.name === "Anna Fischer" && pre.contact && pre.country === undefined && pre.dx === undefined);
ok("sharing cannot be set for a trial the patient did not consent to", (await call(M.cookie, "/api/shares", "PUT", { trialId: t2, sections: [] })).status === 403);
ok("unknown sharing sections are rejected", (await call(A.cookie, "/api/shares", "PUT", { trialId: t1, sections: ["Everything"] })).status === 400);
ok("a patient shares the Diagnosis section", (await call(A.cookie, "/api/shares", "PUT", { trialId: t1, sections: ["Diagnosis"] })).status === 200);
const mid = (await annaOf()).profile;
ok("the researcher then sees the diagnosis but not the country", mid.dx === "Fabry disease" && mid.country === undefined);
ok("a patient adds the About you section", (await call(A.cookie, "/api/shares", "PUT", { trialId: t1, sections: ["Diagnosis", "About you"] })).status === 200 && (await annaOf()).profile.country === "Germany");
ok("a patient can list their consents and what each shares", (await j(await call(A.cookie, "/api/shares"))).consents.some((c) => c.trial_id === t1 && c.sections.length === 2));

const c1 = await j(await call(S.cookie, `/api/trial-contacts?trialId=${t1}&limit=1`));
const c2 = await j(await call(S.cookie, `/api/trial-contacts?trialId=${t1}&limit=1&cursor=${c1.nextCursor}`));
ok("contacts are paged and complete", c1.patients.length === 1 && c1.nextCursor && c2.patients.length === 1 && c2.nextCursor === null && c1.patients[0].wallet !== c2.patients[0].wallet);
ok("the owner receives the consented profile", [...c1.patients, ...c2.patients].some((p) => p.profile && p.profile.name === "Anna Fischer"));
ok("a registered patient who never consented is not exposed", !JSON.stringify([c1, c2]).includes(ravi.address.toLowerCase()));
ok("each profile read is logged", (await db.query("select count(*)::int n from access_log where trial_id=$1", [t1])).rows[0].n >= 2);
// ---------- withdrawal and cross-site protection ----------
await call(M.cookie, "/api/shares", "PUT", { trialId: t1, sections: ["Treatment"] });
await (await chain(mei).withdraw(t1)).wait(); await sync();
ok("withdrawal lowers the public consent count", (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).consents === 1);
ok("a withdrawn patient is no longer released to the researcher", !(await j(await call(S.cookie, `/api/trial-contacts?trialId=${t1}&limit=100`))).patients.some((p) => p.wallet === mei.address.toLowerCase()));
ok("withdrawal removes the sharing record", (await db.query("select count(*)::int n from shares where trial_id=$1 and patient=$2", [t1, mei.address.toLowerCase()])).rows[0].n === 0);
await (await chain(mei).consent(t1, lf, [tm.getProof(lf)], "0x")).wait(); await sync();
ok("a withdrawn patient can consent again", (await j(await call("", "/api/trials?limit=50"))).trials.find((t) => t.id === t1).consents === 2);
ok("requests from another site are refused", (await call(A.cookie, "/api/profile", "PUT", annaP, { origin: "https://evil.example" })).status === 403);
ok("requests from the same site are accepted", (await call(A.cookie, "/api/profile", "PUT", annaP, { origin: BASE })).status === 200);
ok("deleting data removes the profile but keeps the consent", (await call(A.cookie, "/api/profile", "DELETE")).status === 200
  && (await j(await call(S.cookie, `/api/trial-contacts?trialId=${t1}&limit=100`))).patients.some((p) => p.wallet === anna.address.toLowerCase() && p.profile === null));
await (await chain(sponsorA).closeTrial(t3)).wait(); await sync();
ok("closed trials leave the public list", !(await j(await call("", "/api/trials?limit=50"))).trials.some((t) => t.id === t3));
ok("closed trials stay in the owner's list", (await j(await call("", `/api/trials?researcher=${sponsorA.address}&limit=50`))).trials.some((t) => t.id === t3 && t.open === false));
const h = await j(await call("", "/api/health"));
ok("readiness reports index lag", (await call("", "/api/health")).status === 200 && typeof h.indexer?.lag === "number" && h.indexer.lag <= 1);
ok("liveness needs no dependencies", (await call("", "/api/live")).status === 200);

const lo = await call(S.cookie, "/api/auth/logout", "POST");
ok("signing out clears the session cookie", lo.status === 200 && (lo.headers.get("set-cookie") || "").includes("Max-Age=0"));

// ---------- request limiting ----------
const codes = []; for (let i = 0; i < 12; i++) codes.push((await call("", `/api/auth/nonce?wallet=${outsider.address}`, "GET", undefined, { "x-forwarded-for": `203.0.113.${i + 1}` })).status);
ok("rotating X-Forwarded-For cannot bypass the limit", codes.includes(429));
await db.end();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
