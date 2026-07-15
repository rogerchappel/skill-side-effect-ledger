# Product Requirements: skill-side-effect-ledger

## Goal

Create a local-first CLI that turns agent run logs into a reviewable side-effect ledger.

## Users

- Agents preparing dry-run action plans.
- Reviewers auditing connector or file-system activity.
- Skill authors documenting approval boundaries.

## Acceptance Criteria

- Read markdown transcripts and JSONL event logs.
- Detect local reads, local writes, external reads, external writes, and unknown events.
- Emit markdown and JSON reports.
- Exit non-zero when configured risk thresholds are met.
- Include tests, fixtures, smoke command, and skill guidance.

## Non-Goals

- No live connector calls.
- No mutation of source logs.
- No automatic approval decisions.
