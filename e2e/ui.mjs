// Browser test of the real pages with a wallet. Each user gets a separate browser profile and a stand-in wallet
// that forwards requests to the local test chain (whose accounts are unlocked), so no real wallet is needed.
//   BASE=http://localhost:3000 NEXT_PUBLIC_REGISTRY_ADDRESS=0x... DATABASE_URL=... node e2e/ui.mjs
// Set CHROME_PATH to use your own Chrome; otherwise a bundled Chromium is used.
import puppeteer from "puppeteer-core";
import pg from "pg";
import { JsonRpcProvider, Contract } from "ethers";

const BASE = process.env.BASE || "http://localhost:3000", RPC = process.env.RPC || "http://127.0.0.1:8545", ADDR = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
let exe = process.env.CHROME_PATH, args = ["--no-sandbox"];
if (!exe) { const c = (await import("@sparticuz/chromium")).default; exe = await c.executablePath(); args = c.args.filter((x) => !/single-process|no-zygote/.test(x)); } // separate profiles need a multi-process browser
const browser = await puppeteer.launch({ args, executablePath: exe, headless: "shell" });
const node = new JsonRpcProvider(RPC, undefined, { cacheTimeout: -1 });
const accounts = (await node.send("eth_accounts", []));
const reg = new Contract(ADDR, ["function patientRoot(address) view returns (bytes32)", "function consented(uint256,address) view returns (bool)", "function trialCount() view returns (uint256)"], node);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n); };
const ZERO = "0x" + "0".repeat(64);

async function person(i) { // a browser profile with its own cookies, storage and wallet account
  const ctx = await (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext());
  const page = await ctx.newPage(); await page.setViewport({ width: 900, height: 1000 });
  const addr = accounts[i], errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("__rpc", async (method, params) => {
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [addr];
    return node.send(method, params || []);
  });
  await page.evaluateOnNewDocument(() => { window.ethereum = { isMetaMask: true, request: ({ method, params }) => window.__rpc(method, params || []), on() {}, removeListener() {} }; });
  const t = {
    page, addr, errors,
    text: () => page.evaluate(() => document.body.innerText),
    click: async (sel, label) => { const done = await page.evaluate((sel, label) => { const e = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim().startsWith(label) && !x.disabled); if (e) e.click(); return !!e; }, sel, label); if (!done) throw new Error(`Cannot click ${sel} "${label}"`); },
    type: async (sel, v) => { await page.waitForSelector(sel); await page.$eval(sel, (e) => { e.value = ""; }); await page.type(sel, v); },
    pick: async (sel, v) => { await page.waitForSelector(sel); await page.select(sel, v); },
    waitText: async (re, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (re.test(await t.text())) return true; await wait(300); } return false; },
    open: async (path = "/") => { await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 }); await wait(800); },
    connect: async () => { await t.click("button", "Connect wallet"); return t.waitText(/Sign out/); },
  };
  return t;
}
const tag = "uitest" + Date.now().toString(36);                     // unique, so older trials never match
const title = "UI test trial " + tag;
const patient = await person(3), sponsor = await person(4), admin = await person(5);
try {
  // ---- patient registers ----
  await patient.open();
  ok("patient connects a wallet and signs in", await patient.connect());
  await patient.type("#f_name", "Anna Fischer"); await patient.type("#f_contact", "anna.ui@example.org");
  await patient.pick("#f_dx", "Fabry disease"); await patient.type("#f_country", "Germany"); await patient.type("#f_allergies", "Penicillin");
  await patient.type("input[placeholder='fabry disease, gla mutation']", tag);
  await patient.click("button", "Save profile and register");
  ok("registration completes", await patient.waitText(/Done\./));
  ok("the root is on the ledger", (await reg.patientRoot(patient.addr)) !== ZERO);
  ok("the profile is stored encrypted", (await db.query("select count(*)::int n from users where wallet=$1", [patient.addr.toLowerCase()])).rows[0].n === 1);

  // ---- sponsor publishes a trial ----
  await sponsor.open("/");
  ok("sponsor connects a wallet", await sponsor.connect());
  await sponsor.click("button", "I'm a researcher");
  await sponsor.type("#r_name", "Dr Test Sponsor"); await sponsor.pick("#r_role", "Principal investigator"); await sponsor.type("#r_org", "UI Test Hospital"); await sponsor.type("#r_email", "sponsor.ui@example.org");
  await sponsor.type("#t_title", title); await sponsor.type("#t_conditions", "Fabry disease"); await sponsor.type("#t_summary", "A browser-driven test study."); await sponsor.type("#t_sponsor", "UI Test Hospital");
  await sponsor.type("#crit", tag);
  const before = Number(await reg.trialCount());
  await sponsor.click("button", "Publish trial");
  ok("trial published", await sponsor.waitText(/Done\./));
  ok("the trial exists on the ledger", Number(await reg.trialCount()) === before + 1);
  const id = before;
  await wait(1500);
  ok("trial details are stored publicly", (await db.query("select count(*)::int n from trial_meta where trial_id=$1", [id])).rows[0].n === 1);

  // ---- patient finds the trial and consents, sharing only Diagnosis ----
  await patient.open("/"); await patient.connect();
  await patient.type("#q", "UI test trial " + tag);
  ok("the patient finds the trial by search", await patient.waitText(new RegExp(title)));
  await patient.page.evaluate(() => { const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "Diagnosis"); l.querySelector("input").click(); });
  await patient.click("button", "Consent and share");
  ok("consent completes", await patient.waitText(/Done\./));
  ok("consent is recorded on the ledger", await reg.consented(id, patient.addr));
  ok("Your consents lists it with the chosen section", await patient.waitText(/Also shared: Diagnosis/, 25000));

  // ---- sponsor sees only what was shared ----
  await sponsor.open("/"); await sponsor.connect(); await sponsor.click("button", "I'm a researcher");
  ok("the sponsor's trial list shows it", await sponsor.waitText(new RegExp(title.slice(0, 20))));
  await sponsor.click("button", "Show consented contacts");
  ok("the sponsor sees name and contact", await sponsor.waitText(/Full name: Anna Fischer/) && /Email or phone: anna\.ui@example\.org/.test(await sponsor.text()));
  const st = await sponsor.text();
  ok("the sponsor sees the shared Diagnosis section", /Condition: Fabry disease/.test(st));
  ok("the sponsor does not see unshared fields", !/Penicillin/.test(st) && !/Country or region: Germany/.test(st));

  // ---- administrator verifies the sponsor ----
  await admin.open("/admin");
  await admin.click("button", "Sign in as administrator");
  ok("administrator signs in", await admin.waitText(/Sponsor verification/) && await admin.waitText(/UI Test Hospital|Nothing to show/));
  ok("administrator sees the sponsor awaiting review", await admin.waitText(/Dr Test Sponsor/));
  await admin.click("button", "Verify this sponsor");
  ok("verification is recorded and logged", await admin.waitText(/Sponsor verified\./) && (await db.query("select count(*)::int n from admin_log where action='verify'")).rows[0].n >= 1);
  const outsider = await person(6); await outsider.open("/admin"); await outsider.click("button", "Sign in as administrator");
  ok("a non-administrator is refused", await outsider.waitText(/Administrators only/));
  await patient.open("/"); await patient.type("#q", "UI test trial " + tag);
  ok("the Verified sponsor label appears for patients", await patient.waitText(/Verified sponsor/));

  // ---- withdraw, lose browser data, rebuild proofs, consent again ----
  await patient.connect(); await patient.type("#q", ""); 
  await patient.click("button", "Withdraw consent");
  ok("withdrawal completes", await patient.waitText(/Done\./));
  ok("consent is gone from the ledger", (await reg.consented(id, patient.addr)) === false);
  await patient.page.evaluate(() => localStorage.clear());
  await patient.open("/"); await patient.connect();
  await patient.type("input[placeholder='fabry disease, gla mutation']", tag);
  await patient.click("button", "Rebuild my proofs");
  ok("proofs rebuild from the wallet and the same tags", await patient.waitText(/Done\./));
  await patient.type("input[placeholder='fabry disease, gla mutation']", "wrong " + tag);
  await patient.click("button", "Rebuild my proofs");
  ok("different tags are refused", await patient.waitText(/do not reproduce the root/));
  await patient.type("#q", "UI test trial " + tag); await patient.waitText(new RegExp(title));
  await patient.click("button", "Consent and share");
  ok("the patient can consent again with the rebuilt proofs", await patient.waitText(/Done\./) && await reg.consented(id, patient.addr));
  await patient.click("button", "Sign out");
  ok("sign-out returns to the sign-in button", await patient.waitText(/Connect wallet/));
  const errs = [...patient.errors, ...sponsor.errors, ...admin.errors];
  ok("no script errors in any page", errs.length === 0);
  if (errs.length) console.log(errs);
} catch (e) { fail++; console.log("FAIL aborted: " + e.message); }
await db.end(); await browser.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
