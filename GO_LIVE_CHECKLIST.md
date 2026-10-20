# Go-live checklist for real patient data

The software gate (`scripts/preflight.js`) checks settings. These items are done by people and organisations, and it cannot verify them. Do not allow real patients to use the service until every line has an owner, a date and evidence.

| Item | What counts as evidence | Owner | Done |
|---|---|---|---|
| Independent audit of `TrialRegistry.sol` (including `withdraw`) | Published report, findings fixed and re-checked | | |
| Web application penetration test | Report from an accredited tester, findings closed | | |
| Legal review of privacy policy and terms; data protection impact assessment | Signed approval | | |
| Clinical review and sourcing of the disease library | Named clinician sign-off, dated sources | | |
| Accessibility audit (WCAG 2.1 AA and any government web guidelines that apply) | Audit report, fixes verified | | |
| Ethics or regulatory position on running a patient recruitment registry | Written confirmation from the responsible body | | |
| Ledger decision (public or permissioned) and contract deployed there | Address, network, node hosting arrangement | | |
| Hosting in the required jurisdiction, database and RPC node inside it | Architecture sign-off | | |
| Keys generated and stored in a key vault or HSM, rotation rehearsed | Rehearsal record | | |
| Sponsor verification procedure written and staffed | Procedure document, trained administrators | | |
| Backups and a restore test | Restore test record | | |
| Incident response plan and reporting duties confirmed | Approved plan, contacts | | |
| Load test on production-like hosting | Results against agreed targets | | |
| Support process for patients and researchers | Published contact and response times | | |
