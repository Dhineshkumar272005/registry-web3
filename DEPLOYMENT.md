# Deployment guide

## Architecture
Stateless web tier (this image, 3+ replicas) -> managed PostgreSQL (user information, sealed per record) and an EVM ledger node (consent records). Scale the web tier horizontally. The database is the only stateful component the operator must back up.

## Decisions to make first
1. **Ledger.** The contract runs on any EVM-compatible network. Choose a public network, or a permissioned network whose validator nodes you host in-country, and set `NEXT_PUBLIC_CHAIN_*` accordingly. Deploy with `npx hardhat run scripts/deploy.js --network <name>` after adding that network to `hardhat.config.js`.
2. **Hosting.** Use an approved cloud or data centre in the required jurisdiction. Keep the database and the ledger RPC node inside it.
3. **Keys.** Generate `DATA_KEY` and `JWT_SECRET` in your key vault or HSM, inject them as secrets, and plan rotation.

## Release gate
Production images build only when `scripts/preflight.js` passes. It requires: a non-test chain, an https RPC, a published independent contract audit, completed legal and clinical content review, operator identity, and strong secrets. Do not set the review flags until the reviews are actually complete.

## Steps
1. `psql "$DATABASE_URL" -f db/schema.sql`
2. Build: `docker build --build-arg NEXT_PUBLIC_ENV=production --build-arg NEXT_PUBLIC_REGISTRY_ADDRESS=0x... (all NEXT_PUBLIC_* from .env.example) -t REGISTRY_HOST/trial-registry:VERSION .`
3. Create the secret, edit hostnames and image in `deploy/k8s/registry.yaml`, then `kubectl apply -f deploy/k8s/registry.yaml`.
4. Point your monitor at `/api/health` and your log pipeline at container stdout.
5. Sign in at `/admin` with a wallet listed in `ADMIN_WALLETS` and review sponsors there (see Administration below).

## Before go-live (confirm each with your authority)
- Independent smart-contract audit and a web application penetration test by an accredited auditor.
- Data protection impact assessment and legal review of the privacy policy and terms.
- Clinician review and sourcing of the disease library.
- Accessibility audit against WCAG 2.1 AA and any applicable government web guidelines.
- Backups with point-in-time recovery and a tested restore, a disaster-recovery plan, and an incident-response plan that meets your reporting duties.
- Log retention and incident-reporting rules that apply to you. Check them with your security authority.
- A WAF in front of the ingress, and a dedicated RPC provider or node with rate limits.

## Scaling and capacity
- **Web tier.** Stateless; the autoscaler adds replicas under load. Total database connections equal replicas times `DB_POOL_MAX` (default 5), so keep that product below the database limit or place a pooler such as PgBouncer in transaction mode in front. The application uses no session-level database features.
- **Reads never touch the ledger.** The `registry-indexer` worker copies ledger events into PostgreSQL every 10 seconds. Trial lists, counts and researcher contact lookups read from the database in pages. Set `DEPLOY_BLOCK` so a new index starts at the contract's deployment block, and keep `INDEXER_CONFIRMATIONS` at 12 or higher on public networks. Health shows indexer lag.
- **Caching.** `/api/trials` and `/api/trial-meta` send short `Cache-Control` headers, so a CDN or ingress cache can absorb most public traffic.
- **Rate limits.** Sign-in and personal-data routes are limited through the database, shared by all replicas. Cheap public reads are limited per process, with the edge as the main defence. Set `TRUST_PROXY_HOPS` to the number of proxies in front, otherwise forwarded addresses are ignored.
- **Database.** Use a managed primary with a read replica for reporting, and archive or partition `access_log` by date as it grows. Indexes for every query path are in `db/schema.sql`.
- **Ledger.** Every registration and consent is a transaction paid by the patient, so throughput and fees are those of the chosen network. Decide on fee sponsorship or a permissioned network before onboarding many patients.
- **Load test.** `BASE=https://staging.example npm run loadtest` measures the main read paths. Seed volume with `scripts/seed-load.sql`, run it against staging with `RATE_LIMIT_DISABLED=true`, and repeat it after every significant change. Never set that variable in production; the release gate refuses it.

## Administration and sponsor verification
- List administrator wallet addresses in `ADMIN_WALLETS` (comma separated). Use dedicated wallets, ideally hardware-backed, and keep the list short.
- Administrators sign in at `/admin`, review each researcher's organisation, e-mail, ORCID, web page and ethics reference, and verify or revoke. Every decision is written to `admin_log` with the administrator's wallet and a note. Changing an organisation or e-mail removes verification automatically.
- The tool records decisions. It does not decide how a sponsor is checked. Write that procedure down (who checks, against which sources, how fast) before launch.

## Patient-controlled sharing and withdrawal
A researcher always receives name and contact for a patient who consented. Other profile sections are released only if the patient ticked them when consenting or later in "Your consents". A patient can withdraw consent on the ledger at any time. Withdrawal removes access from that moment, but it cannot recall details a researcher has already read, which the interface says plainly.

## Recoverable proofs
The padding in each patient's Merkle tree is derived from a signature that only the patient's wallet can produce. If browser data is lost, the patient enters the same tags and chooses "Rebuild my proofs". Nothing is stored on a server and nothing needs backing up. Trees created before this change cannot be rebuilt this way.

## Key rotation
Keys live in `DATA_KEYS="2:<new>,1:<old>"` (newest first). Deploy with both keys, run `node scripts/rotate-keys.js` (use `--dry-run` first), confirm it reports nothing left, then remove the old key and deploy again. Rehearse this on a copy of production data before the first real rotation. Records created before key ids were introduced must be re-created.

## Before real patients use it
See `GO_LIVE_CHECKLIST.md`. The release gate checks configuration, but it cannot check that the audits, reviews and approvals it asks you to confirm have really happened.
