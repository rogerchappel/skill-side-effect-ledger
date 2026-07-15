# Orchestration

## Agent Flow

1. Collect the run log or transcript after the agent finishes.
2. Run `skill-side-effect-ledger --input <log> --format markdown`.
3. Review unknown and external-write entries before handoff.
4. Include the ledger in PRs, action approvals, or incident notes.

## CI Flow

```bash
npm test
npm run check
npm run smoke
```

## Side Effects

The tool reads one local log file and writes a report to standard output. It must not mutate logs, send notifications, or perform connector actions.
