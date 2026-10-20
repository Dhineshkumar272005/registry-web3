// Usage: BASE=https://your-host CONNECTIONS=50 DURATION=15 npm run loadtest
// Run against a staging copy with RATE_LIMIT_DISABLED=true (per-client limits would otherwise answer 429).
// Optional: COOKIE="session=..." TRIAL_ID=1000 also tests the researcher contact lookup.
const autocannon = require("autocannon");
const base = process.env.BASE || "http://localhost:3000";
const connections = Number(process.env.CONNECTIONS || 50), duration = Number(process.env.DURATION || 10);
const targets = [
  ["Home page", "/"],
  ["Trial list, first page", "/api/trials?limit=20"],
  ["Trial list, deep page", "/api/trials?limit=20&cursor=" + (process.env.DEEP_CURSOR || 5000)],
  ["Trial search", "/api/trials?q=fabry"],
  ["Trial list by condition", "/api/trials?condition=" + encodeURIComponent("Fabry disease")],
  ["Readiness check", "/api/health"],
];
if (process.env.COOKIE) targets.push(["Researcher contacts, page of 50", `/api/trial-contacts?limit=50&trialId=${process.env.TRIAL_ID || 0}`, { cookie: process.env.COOKIE }]);
(async () => {
  console.log(`Load test: ${connections} connections for ${duration}s per endpoint against ${base}\n`);
  console.log("endpoint".padEnd(34) + "req/s".padStart(9) + "p50 ms".padStart(9) + "p97.5 ms".padStart(10) + "p99 ms".padStart(9) + "max ms".padStart(9) + "  errors");
  for (const [name, path, headers] of targets) {
    const r = await autocannon({ url: base + path, connections, duration, headers });
    const bad = r.non2xx + r.errors + r.timeouts;
    console.log(name.padEnd(34) + String(Math.round(r.requests.average)).padStart(9) + String(r.latency.p50).padStart(9) + String(r.latency.p97_5).padStart(10) + String(r.latency.p99).padStart(9) + String(r.latency.max).padStart(9) + "  " + bad + (bad ? ` of ${r.requests.total}` : ""));
  }
})();
