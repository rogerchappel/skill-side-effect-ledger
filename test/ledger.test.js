import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { buildLedger, shouldFail } from "../src/index.js";

test("markdown transcripts are classified into side-effect categories", async () => {
  const ledger = await buildLedger("fixtures/run.md");

  assert.equal(ledger.summary.total, 5);
  assert.equal(ledger.summary["local-read"], 1);
  assert.equal(ledger.summary["local-write"], 1);
  assert.equal(ledger.summary["external-read"], 1);
  assert.equal(ledger.summary["external-write"], 1);
  assert.equal(ledger.summary.unknown, 1);
  assert.equal(shouldFail(ledger), true);
});

test("jsonl events are classified conservatively", async () => {
  const ledger = await buildLedger("fixtures/run.jsonl");

  assert.equal(ledger.summary.total, 5);
  assert.equal(ledger.summary["external-write"], 1);
  assert.equal(ledger.summary.unknown, 1);
  assert.equal(shouldFail(ledger, "unknown"), true);
  assert.equal(shouldFail(ledger, "none"), false);
});

test("cli emits markdown and exits non-zero on external writes", () => {
  const result = spawnSync(process.execPath, ["bin/skill-side-effect-ledger.js", "--input", "fixtures/run.md"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Side Effect Ledger/);
  assert.match(result.stdout, /external-write/);
});

test("cli can be configured as report-only", () => {
  const result = spawnSync(process.execPath, ["bin/skill-side-effect-ledger.js", "--input", "fixtures/run.jsonl", "--format", "json", "--fail-on", "none"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary.total, 5);
});
