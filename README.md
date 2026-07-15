# skill-side-effect-ledger

`skill-side-effect-ledger` extracts a concise side-effect ledger from agent run logs. It helps reviewers see which actions were local reads, local writes, external reads, external writes, or unknown actions that need attention.

## Quickstart

```bash
npm test
npm run smoke
node bin/skill-side-effect-ledger.js --input fixtures/run.md --format json
```

## Supported Inputs

- Markdown transcripts with tool-call style lines.
- JSONL logs where each line contains an event object.

## CLI

```bash
skill-side-effect-ledger --input run.md --format markdown
skill-side-effect-ledger --input run.jsonl --format json --fail-on unknown
```

Options:

- `--input <file>` reads a markdown or JSONL log.
- `--format markdown|json` controls output.
- `--fail-on unknown|external-write|none` controls exit behavior.

## Safety Notes

The CLI is read-only. It does not call connectors, write ledgers to disk, send messages, or approve actions.

## Limitations

- Detection is rule-based and intentionally conservative.
- Unknown tool names are surfaced for review instead of ignored.
- The ledger summarizes evidence; it does not prove that every side effect was captured.
