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
- JSONL logs where each non-blank line contains an event object. The `.jsonl`
  filename extension is matched case-insensitively, and reported line numbers
  always refer to physical source lines, including when blank lines occur.

## CLI

```bash
skill-side-effect-ledger --input run.md --format markdown
skill-side-effect-ledger --input run.jsonl --format json --fail-on unknown
```

Options:

- `--input <file>` reads a markdown or JSONL log.
- `--format markdown|json` controls output.
- `--fail-on unknown|external-write|none` controls exit behavior.

Invalid options and option values produce a concise
`skill-side-effect-ledger:` diagnostic on stderr and exit with status 2. Input
and parsing failures use the same diagnostic and exit status without a stack
trace.

## GitHub CLI Coverage

The command classifier treats GitHub CLI operations according to their side
effects:

- `gh workflow run` and `gh run cancel|rerun|delete` are external writes that
  require approval.
- `gh run list|view|status|checks|download` are external reads.

Unrecognized `gh workflow` and `gh run` subcommands remain `unknown` so that
new or ambiguous GitHub CLI behavior is surfaced for human review.

## Safety Notes

The CLI is read-only. It does not call connectors, write ledgers to disk, send messages, or approve actions.

## Limitations

- Detection is rule-based and intentionally conservative. Recognized shell patterns include:
  - Git remote reads (`fetch`, `pull`, `clone`, `ls-remote`) and writes (`push`).
  - GitHub CLI PR, issue, release, and workflow reads; mutating PR, issue, and release commands.
  - Read-only `curl` requests and mutating `POST`, `PUT`, `PATCH`, or `DELETE` requests, including requests that supply data.
  - Common local filesystem readers, writers, shell redirection, and Git workspace mutations.
  - Package publication with npm, pnpm, or Yarn.
- Command recognition does not interpret shell variables, aliases, scripts, or commands hidden inside another program. Those remain unknown unless another explicit rule applies.
- If a command combines operations, the highest-impact recognized direction wins: external writes, then external reads, then local writes, then local reads.
- Unknown tool names are surfaced for review instead of ignored.
- The ledger summarizes evidence; it does not prove that every side effect was captured.
