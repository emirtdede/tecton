# Tecton Documentation

This folder holds the evidence that supports a release: QA reports, screenshots and
the change notes for the current version.

## Contents

| Path | What it contains |
| --- | --- |
| [`reports/QA_AUDIT_REPORT.md`](reports/QA_AUDIT_REPORT.md) | Pre-deployment QA and architecture audit (Turkish), ordered Critical to Low |
| [`reports/QA_FIXES.md`](reports/QA_FIXES.md) | Every finding that was fixed, with the file and the correction |
| [`reports/RELEASE_CHECKLIST.md`](reports/RELEASE_CHECKLIST.md) | The gates a build must pass before it is published |
| [`screenshots/`](screenshots/) | Interface screenshots used as visual proof for the audit |

## Quick links

- [Project README](../README.md)
- [Changelog](../CHANGELOG.md)
- [Licence](../LICENSE)

## Running the gates locally

```bash
npm run style:check # typography: no em dashes, no emoji, no mojibake
npm run i18n:check  # 19 dictionaries, key parity
npm test            # Vitest unit and service tests
npm run quality     # all of the above in one pass
```

## Building a release

```bash
npm ci
npm run build
```

The installer, the block map and `latest.yml` land in `release/`. The CI workflow in
`.github/workflows/ci.yml` runs the same steps on Windows and uploads the installer
as a build artefact.
