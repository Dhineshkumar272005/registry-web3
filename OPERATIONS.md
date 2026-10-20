# Operations runbook

Complete the bracketed items for your organisation. This is a starting structure, not legal or regulatory advice.

## Roles
- Service owner: [name]. Data protection officer or equivalent: [name]. Security contact: [name]. Administrators: [wallets and people].

## Daily and weekly
- Watch `/api/health`: database and ledger reachable, indexer lag small. Alert if lag stays above [N] blocks.
- Review the error rate, response times and autoscaling behaviour.
- Weekly: review `admin_log` and a sample of `access_log` for unexpected reads.

## Backups and recovery
- Managed database backups with point-in-time recovery. Target recovery point [X] and recovery time [Y].
- Test a full restore at least [quarterly] and record the result. After a restore, the indexer rebuilds consent data from the ledger starting at `DEPLOY_BLOCK`.
- Keep the encryption keys in the key vault with their own backup. Without the keys, encrypted records cannot be read.

## Requests from patients
- **Access:** the patient can read their own profile in the application.
- **Deletion:** "Delete my data" removes the profile. Ledger entries hold no personal details and cannot be erased.
- **Withdrawal of consent:** patients withdraw in "Your consents". Tell researchers that already received details if your rules require it.
- **Corrections:** patients edit their profile in the application.

## Incidents
1. Contain: revoke sessions by rotating `JWT_SECRET`, restrict ingress, suspend affected sponsors in `/admin`.
2. Assess using `access_log`, `admin_log` and platform logs: what was read, by whom, when.
3. Notify the people and authorities your rules require, within the deadlines that apply to you: [procedure].
4. Rotate keys if a key may be exposed (see key rotation in `DEPLOYMENT.md`), then record the lessons learned.

## Changes
- Every contract change needs a new audit and redeployment, because deployed contracts cannot be edited. Treat the contract address as part of each release.
- Run `npx hardhat test` and `npm run e2e` before each release, and `npm run loadtest` against staging after significant changes.
