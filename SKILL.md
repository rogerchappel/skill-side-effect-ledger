# Skill Side Effect Ledger

Use this skill when an agent run needs a compact ledger of proposed or observed side effects before handoff, approval, or release-candidate review.

## Inputs

- A local markdown transcript or JSONL event log.

## Tools

- Local shell.
- Node.js 20 or newer.

## Side-Effect Boundaries

This skill is read-only. It can inspect a local log and write a report to standard output. It must not call connectors, send messages, mutate logs, approve actions, publish packages, or push commits.

## Approval Requirements

No approval is needed for read-only ledger generation. Ask for explicit approval before acting on any external-write event found in the ledger.

## Workflow

1. Confirm the log is safe to inspect.
2. Run `skill-side-effect-ledger --input <log> --format markdown`.
3. Review `unknown` and `external-write` entries.
4. Include the ledger in the PR, approval request, or handoff.

## Validation

```bash
npm test
npm run check
npm run smoke
```
