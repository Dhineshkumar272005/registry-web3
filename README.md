# Rare Trial Registry

Next.js frontend + `TrialRegistry.sol` on Polygon Amoy (or Sepolia). No backend, no database:
the chain is the data store and the site is static-friendly, so it scales on a CDN.

## Deploy
1. `npm install && cp .env.example .env` and add a **testnet-only** `DEPLOYER_KEY`.
2. Get test POL from the Polygon Amoy faucet.
3. `npm test` then `npm run deploy:amoy`; copy the printed address into `NEXT_PUBLIC_REGISTRY_ADDRESS`.
4. `npm run dev` locally, or import the repo into Vercel and add the same env vars.

## How it works
- Patient tags are hashed in the browser; a 16-leaf Merkle tree (random filler leaves) gives one root on-chain.
- A trial stores hashed criteria and the researcher's public key.
- `consent()` verifies each Merkle proof on-chain, then logs the contact **encrypted to the trial key** (ECDH + AES-GCM).
- Only the researcher's browser key can decrypt.

## Pre-launch requirements
- Patient proofs and researcher keys live in browser localStorage; add export/backup before real use.
- Match count = patients who consented, not silent eligible counts (that needs ZK proofs).
- Researchers aren't verified, and trial titles are public.
- Use a dedicated RPC (`NEXT_PUBLIC_RPC`) and an indexer (The Graph) once traffic grows.
- Unaudited. Don't put real patient data on it; get legal review (GDPR/DPDP) and a contract audit before mainnet.

## User-information database (added)
Registration details (name, contact, diagnosis, age, symptoms) live in a **separate Postgres database**, never on-chain.
1. Create a dedicated database and run `db/schema.sql`.
2. Set `DATABASE_URL`, `DATA_KEY`, `JWT_SECRET`, `DEPLOY_BLOCK` (see `.env.example`).
3. Flow: wallet signs a one-time challenge, a 1-hour HttpOnly session starts, and the profile is sealed with AES-256-GCM before it is stored.
4. The chain keeps only the Merkle root and the consent record. `/api/trial-contacts` releases a profile only if the caller owns the trial and the contract logged that patient's consent. Each read is written to `access_log`.
5. "Delete my data" removes the row, so erasure requests can actually be honored.
Production still needs: rate limiting, key rotation (store `DATA_KEY` in a KMS), backups, and an event indexer instead of `queryFilter`.

## Going public checklist (added)
- **Hosting:** Vercel (set the env vars) or `docker build --build-arg NEXT_PUBLIC_REGISTRY_ADDRESS=0x... .`. Use your provider's *pooled* Postgres connection string so many instances share the database safely.
- **Built in:** rate limiting (Postgres-backed), security headers and CSP, `/api/health` for monitors, privacy and terms pages, disease library, CI.
- **Before launch:** lawyer-reviewed privacy and terms, clinician-reviewed disease text, contract audit, KMS-held `DATA_KEY`, backups, an event indexer, an uptime monitor on `/api/health`, and a dedicated paid RPC in `NEXT_PUBLIC_RPC`.

## Testing and load testing (added)
- Contract tests: `npx hardhat test`.
- End-to-end suite (57 checks: sign-in, profiles, indexer, paging, access control, deletion, limits): start `npx hardhat node`, deploy the contract, run the app with `INDEXER_CONFIRMATIONS=0` and a `CRON_TOKEN`, then `npm run e2e` (files in `e2e/`) with `BASE`, `NEXT_PUBLIC_REGISTRY_ADDRESS`, `DATABASE_URL` and `CRON_TOKEN` set.
- Load test: seed volume with `scripts/seed-load.sql`, run a staging copy with `RATE_LIMIT_DISABLED=true`, then `BASE=... npm run loadtest`.

## Patient safeguards (added)
Consent withdrawal on the ledger, patient-chosen sharing by profile section, proofs that can be rebuilt from the wallet, an administrator console with an audit log for sponsor verification, encryption key rotation, cross-site request protection and sign-out. See `DEPLOYMENT.md`, `OPERATIONS.md` and `GO_LIVE_CHECKLIST.md`.

## Browser test (added)
`npm run e2e:ui` drives the real pages in a browser (patient, sponsor and administrator in separate profiles) with a stand-in wallet that forwards to the local test chain: registration, publishing, search, consent with section sharing, the sponsor's limited view, administrator verification, withdrawal, proof rebuild and sign-out (28 checks). Set `CHROME_PATH` to use your own Chrome. Run it after the API suite, or wait a minute between them, because the sign-in rate limit applies.
