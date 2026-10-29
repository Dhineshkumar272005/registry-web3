// Refuses to build or start a production deployment that is missing required safeguards.
//   node scripts/preflight.js build     (public settings, run at image build)
//   node scripts/preflight.js runtime   (secrets, run at container start)
try { require("dotenv").config(); } catch {}
const e = process.env, mode = process.argv[2] || "all", prod = e.NEXT_PUBLIC_ENV === "production";
if (!e.NEXT_PUBLIC_REGISTRY_ADDRESS && !prod) {
  e.NEXT_PUBLIC_REGISTRY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
}
if (!e.NEXT_PUBLIC_RPC && !prod) {
  e.NEXT_PUBLIC_RPC = "https://polygon-amoy.g.alchemy.com/v2/alch_XJaWp9zWnEBjBAaY2K6eV";
}
const TESTNETS = ["0x13882", "0x13881", "0xaa36a7", "0x5", "0x7a69", "0x539"];
const fails = [];
const need = (ok, msg) => { if (!ok) fails.push(msg); };
const https = (u) => /^https:\/\/\S+$/.test(u || "");
need(/^0x[0-9a-fA-F]{40}$/.test(e.NEXT_PUBLIC_REGISTRY_ADDRESS || ""), "NEXT_PUBLIC_REGISTRY_ADDRESS must be a deployed contract address");
if (prod && (mode === "build" || mode === "all")) {
  need(!TESTNETS.includes((e.NEXT_PUBLIC_CHAIN_ID_HEX || "0x13882").toLowerCase()), "NEXT_PUBLIC_CHAIN_ID_HEX points to a test network");
  need(!!e.NEXT_PUBLIC_CHAIN_NAME && !!e.NEXT_PUBLIC_CHAIN_SHORT && https(e.NEXT_PUBLIC_EXPLORER), "NEXT_PUBLIC_CHAIN_NAME, NEXT_PUBLIC_CHAIN_SHORT and an https NEXT_PUBLIC_EXPLORER are required");
  need(https(e.NEXT_PUBLIC_RPC), "NEXT_PUBLIC_RPC must be an https endpoint you control or contract with");
  need(https(e.NEXT_PUBLIC_AUDIT_URL), "NEXT_PUBLIC_AUDIT_URL must link to the published independent audit report");
  need(e.NEXT_PUBLIC_LEGAL_REVIEWED === "true" && !!e.NEXT_PUBLIC_LEGAL_UPDATED, "Legal review must be complete (NEXT_PUBLIC_LEGAL_REVIEWED, NEXT_PUBLIC_LEGAL_UPDATED)");
  need(e.NEXT_PUBLIC_CONTENT_REVIEWED === "true", "Clinical review of disease content must be confirmed (NEXT_PUBLIC_CONTENT_REVIEWED)");
  need(!!e.NEXT_PUBLIC_ORG_NAME && /@/.test(e.NEXT_PUBLIC_CONTACT_EMAIL || ""), "NEXT_PUBLIC_ORG_NAME and NEXT_PUBLIC_CONTACT_EMAIL are required");
}
if (prod && (mode === "runtime" || mode === "all")) {
  const keyspec = e.DATA_KEYS || (e.DATA_KEY ? "1:" + e.DATA_KEY : "");
  const parts = keyspec.split(",").filter(Boolean), ids = parts.map((p) => p.split(":")[0]);
  need(parts.length > 0 && parts.every((p) => /^[0-9]{1,3}:[0-9a-fA-F]{64}$/.test(p)) && new Set(ids).size === ids.length && ids.every((i) => +i >= 1 && +i <= 255),
    "DATA_KEYS must be id:64-hex entries with unique ids, newest first (or set DATA_KEY), supplied from your key vault");
  need((e.ADMIN_WALLETS || "").split(",").some((x) => /^0x[0-9a-fA-F]{40}$/.test(x.trim())), "ADMIN_WALLETS must list at least one administrator wallet address");
  need((e.JWT_SECRET || "").length >= 32, "JWT_SECRET must be at least 32 characters");
  need(!!e.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(e.DATABASE_URL), "DATABASE_URL must point to your managed database");
  need((e.CRON_TOKEN || "").length >= 32, "CRON_TOKEN must be at least 32 characters (shared with the indexer worker)");
  need(e.RATE_LIMIT_DISABLED !== "true", "RATE_LIMIT_DISABLED must not be set in production");
  need(e.DATABASE_SSL !== "false", "DATABASE_SSL must not be disabled in production");
}
if (fails.length) {
  console.error(`\nPreflight failed (${prod ? "production" : "staging"}):\n` + fails.map((f) => "  - " + f).join("\n") + "\n");
  process.exit(1);
}
console.log(`Preflight passed (${prod ? "production" : "staging"}, ${mode}).`);
