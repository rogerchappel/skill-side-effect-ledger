# Release Candidate Notes

## Status

Classification: ship

## Verification

- `npm test` - pass, 4 tests.
- `npm run check` - pass, Node syntax checks.
- `npm run smoke` - pass, markdown ledger with 5 events and 1 approval-required event.

## Risks

- Rule-based detection may miss custom tool naming conventions.
- Unknown events are intentionally warnings so reviewers can extend rules.
